/**
 * Módulo: household-migration
 * Criado em: 2026-11-01
 * Última atualização: 2026-11-01
 * Intuito: A migration household_multi_group e o down.sql rodam sobre dados que já existem, num banco descartável, sem deixar estado parcial.
 * Sequência: com dados da versão anterior, todo grupo vira individual e nada muda nas linhas; role inválida aborta sem estado parcial e, depois de corrigir o dado, aplica limpo; falha no meio da migration desfaz tudo; lock preso esgota o lock_timeout, no DO e no DDL, sem estado parcial; o down.sql aborta com alguém em dois grupos; o down.sql aborta com alguém dono de dois grupos; o down.sql desfaz tudo quando ninguém está em dois grupos, o migrate status engana até apagar a linha de _prisma_migrations, e a linha apagada deixa a migration aplicar de novo; resolve --rolled-back recusa a migration aplicada.
 * Só roda com RUN_DB_TESTS=1 e PG_TEST_URL. Cada teste cria o próprio database no mesmo container e apaga no fim.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from 'pg';

const DATABASE_URL =
  process.env.RUN_DB_TESTS === '1' ? process.env.PG_TEST_URL : undefined;
const API_DIR = resolve(__dirname, '../..');
const MIGRATIONS_DIR = resolve(API_DIR, 'prisma/migrations');
const MIGRATION_NAME = '20261101120000_household_multi_group';
const DOWN_SQL = resolve(MIGRATIONS_DIR, MIGRATION_NAME, 'down.sql');
const TIMEOUT = 180_000;

/** O que a migration cria. Nada disto pode sobrar depois de uma falha. */
const NEW_OBJECTS_SQL = `
  SELECT 'column:personal' AS name FROM information_schema.columns
    WHERE table_name = 'households' AND column_name = 'personal'
  UNION ALL SELECT 'column:created_at' FROM information_schema.columns
    WHERE table_name = 'household_members' AND column_name = 'created_at'
  UNION ALL SELECT 'column:guest_group_limit' FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'guest_group_limit'
  UNION ALL SELECT 'index:' || indexname FROM pg_indexes
    WHERE indexname IN ('households_owner_company_id_personal_key', 'household_members_company_id_idx')
  UNION ALL SELECT 'constraint:' || conname FROM pg_constraint
    WHERE conname = 'household_members_role_check'
`;
const OLD_INDEXES_SQL = `
  SELECT indexname FROM pg_indexes
  WHERE indexname IN ('households_owner_company_id_key', 'household_members_company_id_key')
  ORDER BY indexname
`;
const OLD_INDEXES = [
  'household_members_company_id_key',
  'households_owner_company_id_key',
];
/** Tabelas com os dados da pessoa, com a coluna que ordena a comparação. */
const SEEDED_TABLES = [
  ['companies', 'id'],
  ['person_names', 'company_id'],
  ['households', 'id'],
  ['household_members', 'id'],
  ['household_invites', 'id'],
  ['statements', 'id'],
  ['expenses', 'id'],
] as const;

function run(args: string[], databaseUrl: string): string {
  return execFileSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

/** Saída de um comando que precisa falhar. */
function runExpectingFailure(args: string[], databaseUrl: string): string {
  try {
    run(args, databaseUrl);
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
  }
  throw new Error(`prisma ${args.join(' ')} deveria ter falhado`);
}

function urlForDatabase(databaseUrl: string, databaseName: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

describe.skipIf(!DATABASE_URL)('migration household_multi_group', () => {
  if (!DATABASE_URL) return;
  const adminUrl = DATABASE_URL;
  let tempDir = '';
  let previousConfig = '';
  let historyThroughThis = '';
  let databaseCounter = 0;

  beforeAll(() => {
    // Histórico até a migration anterior, para semear no schema da develop.
    tempDir = mkdtempSync(join(tmpdir(), 'y2p-household-migration-'));
    const previous = join(tempDir, 'migrations');
    cpSync(MIGRATIONS_DIR, previous, { recursive: true });
    // Tira também as migrations mais novas: o histórico para antes desta.
    for (const entry of readdirSync(previous)) {
      if (/^\d/.test(entry) && entry >= MIGRATION_NAME) {
        rmSync(join(previous, entry), { recursive: true });
      }
    }
    expect(readdirSync(previous)).not.toContain(MIGRATION_NAME);
    historyThroughThis = join(tempDir, 'through');
    cpSync(previous, historyThroughThis, { recursive: true });
    cpSync(
      join(MIGRATIONS_DIR, MIGRATION_NAME),
      join(historyThroughThis, MIGRATION_NAME),
      { recursive: true },
    );
    previousConfig = join(tempDir, 'prisma.config.ts');
    writeFileSync(
      previousConfig,
      `export default ${JSON.stringify({
        schema: resolve(API_DIR, 'prisma/schema.prisma'),
        migrations: { path: previous },
        datasource: { url: process.env.PG_TEST_URL },
      })};\n`,
    );
  });

  afterAll(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  /** Database novo, com as migrations até a anterior. Apagado no fim do teste. */
  async function withPreviousSchema(
    work: (client: Client, url: string) => Promise<void>,
  ) {
    databaseCounter += 1;
    const name = `y2p_mig_${process.pid}_${Date.now()}_${databaseCounter}`;
    const url = urlForDatabase(adminUrl, name);
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    const client = new Client({ connectionString: url });
    try {
      // O config do histórico lê a URL do arquivo, então cada database tem o seu.
      const config = join(tempDir, `${name}.config.ts`);
      writeFileSync(
        config,
        readFileSync(previousConfig, 'utf8').replace(
          JSON.stringify(process.env.PG_TEST_URL),
          JSON.stringify(url),
        ),
      );
      run(['migrate', 'deploy', '--config', config], url);
      await client.connect();
      await work(client, url);
    } finally {
      await client.end().catch(() => undefined);
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    }
  }

  /** Duas famílias, um dono sozinho, gastos, extrato, convite e nome. */
  async function seed(client: Client) {
    await client.query(`
      INSERT INTO companies (id, privy_user_id) VALUES
        ('co_dona', 'p_dona'), ('co_membro', 'p_membro'),
        ('co_dono2', 'p_dono2'), ('co_membro2', 'p_membro2'),
        ('co_sozinho', 'p_sozinho'), ('co_sem_grupo', 'p_sem_grupo');
      INSERT INTO person_names (company_id, display_name, full_name, email) VALUES
        ('co_dona', 'Dona', 'Dona Silva', 'dona@example.test'),
        ('co_membro', 'Membro', NULL, 'membro@example.test');
      INSERT INTO households (id, name, owner_company_id, onboarding_completed, monthly_income_cents, priorities) VALUES
        ('h_familia', 'Família', 'co_dona', true, 500000, '{gastos,reserva}'),
        ('h_familia2', 'Outra família', 'co_dono2', false, NULL, '{}'),
        ('h_sozinho', 'Só eu', 'co_sozinho', true, 100000, '{}');
      INSERT INTO household_members (id, household_id, company_id, role) VALUES
        ('m_dona', 'h_familia', 'co_dona', 'owner'),
        ('m_membro', 'h_familia', 'co_membro', 'member'),
        ('m_dono2', 'h_familia2', 'co_dono2', 'owner'),
        ('m_membro2', 'h_familia2', 'co_membro2', 'member'),
        ('m_sozinho', 'h_sozinho', 'co_sozinho', 'owner');
      INSERT INTO household_invites (id, household_id, email, status) VALUES
        ('i_pendente', 'h_familia', 'novo@example.test', 'pending');
      INSERT INTO statements (id, household_id, added_by_company_id, filename, format, content_hash) VALUES
        ('s_1', 'h_familia', 'co_dona', 'extrato.ofx', 'ofx', 'hash-1');
      INSERT INTO expenses (id, household_id, added_by_company_id, statement_id, spent_on, merchant, category, fixed, amount_cents, fit_id) VALUES
        ('e_1', 'h_familia', 'co_dona', 's_1', '2026-10-01', 'Mercado', 'groceries', false, 12345, 'fit-1'),
        ('e_2', 'h_familia', 'co_membro', NULL, '2026-10-02', 'Farmácia', 'health', false, 6789, NULL),
        ('e_3', 'h_sozinho', 'co_sozinho', NULL, '2026-10-03', 'Aluguel', 'housing', true, 200000, NULL);
    `);
  }

  /** Linhas das tabelas semeadas, só com as colunas de antes da migration. */
  async function snapshot(client: Client, columns: Map<string, string[]>) {
    const rows: Record<string, unknown[]> = {};
    for (const [table, orderBy] of SEEDED_TABLES) {
      const list = (columns.get(table) ?? [])
        .map((column) => `"${column}"`)
        .join(', ');
      const result = await client.query(
        `SELECT ${list} FROM "${table}" ORDER BY "${orderBy}"`,
      );
      rows[table] = result.rows;
    }
    return rows;
  }

  async function columnsOf(client: Client) {
    const columns = new Map<string, string[]>();
    for (const [table] of SEEDED_TABLES) {
      const result = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table],
      );
      columns.set(
        table,
        result.rows.map((row) => row.column_name),
      );
    }
    return columns;
  }

  async function expectNoPartialState(client: Client) {
    const created = await client.query(NEW_OBJECTS_SQL);
    expect(created.rows).toEqual([]);
    const oldIndexes = await client.query<{ indexname: string }>(
      OLD_INDEXES_SQL,
    );
    expect(oldIndexes.rows.map((row) => row.indexname)).toEqual(OLD_INDEXES);
  }

  async function migrationRow(client: Client) {
    const result = await client.query<{
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>(
      `SELECT finished_at, rolled_back_at FROM _prisma_migrations
       WHERE migration_name = $1 ORDER BY started_at DESC`,
      [MIGRATION_NAME],
    );
    return result.rows;
  }

  async function applyDown(client: Client) {
    await client.query(readFileSync(DOWN_SQL, 'utf8'));
  }

  it(
    'com dados da versão anterior, todo grupo vira individual e nada muda nas linhas',
    async () => {
      await withPreviousSchema(async (client, url) => {
        await seed(client);
        const columns = await columnsOf(client);
        const before = await snapshot(client, columns);

        run(['migrate', 'deploy'], url);

        expect(await snapshot(client, columns)).toEqual(before);
        expect(before.households).toHaveLength(3);
        expect(before.household_members).toHaveLength(5);
        expect(before.expenses).toHaveLength(3);

        const households = await client.query(
          `SELECT id FROM households WHERE NOT personal`,
        );
        expect(households.rows).toEqual([]);
        const limits = await client.query(
          `SELECT id FROM companies WHERE guest_group_limit IS NOT NULL`,
        );
        expect(limits.rows).toEqual([]);
        const check = await client.query<{ convalidated: boolean }>(
          `SELECT convalidated FROM pg_constraint WHERE conname = 'household_members_role_check'`,
        );
        expect(check.rows).toEqual([{ convalidated: true }]);
        const oldIndexes = await client.query(OLD_INDEXES_SQL);
        expect(oldIndexes.rows).toEqual([]);

        const rows = await migrationRow(client);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.finished_at).not.toBeNull();
        expect(run(['migrate', 'status'], url)).toMatch(/up to date/i);
      });
    },
    TIMEOUT,
  );

  it(
    'role inválida aborta sem estado parcial e, depois de corrigir o dado, aplica limpo',
    async () => {
      await withPreviousSchema(async (client, url) => {
        await seed(client);
        await client.query(
          `UPDATE household_members SET role = 'admin' WHERE id = 'm_membro'`,
        );

        const output = runExpectingFailure(['migrate', 'deploy'], url);
        expect(output).toContain('P3018');
        expect(output).toContain('há role fora de (owner, member)');

        await expectNoPartialState(client);
        const failed = await migrationRow(client);
        expect(failed).toHaveLength(1);
        expect(failed[0]?.finished_at).toBeNull();
        // O passo a passo do docs/DEPLOY.md: migrate status acusa a falha,
        // corrige o dado, resolve e deploy. O status lê o histórico que para
        // nesta migration: com uma mais nova pendente, ele lista só a pendente
        // e não cita a que falhou.
        const throughThis = join(
          tempDir,
          `${databaseCounter}-through.config.ts`,
        );
        writeFileSync(
          throughThis,
          `export default ${JSON.stringify({
            schema: resolve(API_DIR, 'prisma/schema.prisma'),
            migrations: { path: historyThroughThis },
            datasource: { url },
          })};\n`,
        );
        expect(
          runExpectingFailure(
            ['migrate', 'status', '--config', throughThis],
            url,
          ),
        ).toContain(MIGRATION_NAME);
        await client.query(
          `UPDATE household_members SET role = 'member' WHERE id = 'm_membro'`,
        );
        run(['migrate', 'resolve', '--rolled-back', MIGRATION_NAME], url);
        run(['migrate', 'deploy'], url);

        const created = await client.query(NEW_OBJECTS_SQL);
        expect(created.rows.map((row) => row.name).sort()).toEqual([
          'column:created_at',
          'column:guest_group_limit',
          'column:personal',
          'constraint:household_members_role_check',
          'index:household_members_company_id_idx',
          'index:households_owner_company_id_personal_key',
        ]);
        const personal = await client.query(
          `SELECT id FROM households WHERE NOT personal`,
        );
        expect(personal.rows).toEqual([]);
        expect(run(['migrate', 'status'], url)).toMatch(/up to date/i);
      });
    },
    TIMEOUT,
  );

  it(
    'falha no meio da migration desfaz tudo e o caminho de recuperação funciona',
    async () => {
      await withPreviousSchema(async (client, url) => {
        await seed(client);
        // Índice no caminho: a migration falha depois de já ter criado a coluna
        // personal, feito o UPDATE e trocado os índices de households.
        await client.query(
          `CREATE INDEX "household_members_company_id_idx" ON household_members (role)`,
        );

        const output = runExpectingFailure(['migrate', 'deploy'], url);
        expect(output).toMatch(/current transaction is aborted|already exists/);

        const leftovers = await client.query(NEW_OBJECTS_SQL);
        expect(leftovers.rows).toEqual([
          { name: 'index:household_members_company_id_idx' },
        ]);
        const oldIndexes = await client.query<{ indexname: string }>(
          OLD_INDEXES_SQL,
        );
        expect(oldIndexes.rows.map((row) => row.indexname)).toEqual(
          OLD_INDEXES,
        );

        await client.query(`DROP INDEX "household_members_company_id_idx"`);
        run(['migrate', 'resolve', '--rolled-back', MIGRATION_NAME], url);
        run(['migrate', 'deploy'], url);
        expect(run(['migrate', 'status'], url)).toMatch(/up to date/i);
      });
    },
    TIMEOUT,
  );

  // O DO roda antes do BEGIN e dá o erro real; o DDL roda dentro e o mascara.
  it.each([
    ['household_members', 'no DO', /55P03|lock timeout/],
    ['households', 'no DDL', /current transaction is aborted/],
  ])(
    'lock preso em %s esgota o lock_timeout %s, sem estado parcial',
    async (table, _where, expectedError) => {
      await withPreviousSchema(async (client, url) => {
        await seed(client);
        const holder = new Client({ connectionString: url });
        await holder.connect();
        try {
          await holder.query('BEGIN');
          // Se o lock_timeout sumir, o servidor solta o lock e o deploy passa,
          // o que falha o teste em vez de travar a suíte.
          await holder.query(
            `SET LOCAL idle_in_transaction_session_timeout = '20s'`,
          );
          await holder.query(`LOCK TABLE "${table}" IN ACCESS EXCLUSIVE MODE`);

          const output = runExpectingFailure(['migrate', 'deploy'], url);
          expect(output).toMatch(expectedError);
        } finally {
          await holder.end().catch(() => undefined);
        }

        await expectNoPartialState(client);
        const failed = await migrationRow(client);
        expect(failed[0]?.finished_at).toBeNull();
      });
    },
    TIMEOUT,
  );

  it(
    'o down.sql aborta com alguém em dois grupos, sem desfazer nada',
    async () => {
      await withPreviousSchema(async (client, url) => {
        await seed(client);
        run(['migrate', 'deploy'], url);
        await client.query(`
          INSERT INTO households (id, name, owner_company_id, personal) VALUES ('h_membro', 'Meu grupo', 'co_membro', true);
          INSERT INTO household_members (id, household_id, company_id, role) VALUES ('m_membro_dono', 'h_membro', 'co_membro', 'owner');
        `);

        await expect(applyDown(client)).rejects.toThrow(
          /household_multi_group down: há pessoa em dois ou mais grupos/,
        );
        await client.query('ROLLBACK');
        const created = await client.query(NEW_OBJECTS_SQL);
        expect(created.rows).toHaveLength(6);
      });
    },
    TIMEOUT,
  );

  it(
    'o down.sql aborta com alguém dono de dois grupos, sem desfazer nada',
    async () => {
      await withPreviousSchema(async (client, url) => {
        await seed(client);
        run(['migrate', 'deploy'], url);
        // Dono de dois grupos, mas com membership só no primeiro: a trava de
        // pessoas em dois grupos não pega este caso.
        await client.query(`
          INSERT INTO households (id, name, owner_company_id, personal) VALUES ('h_segundo', 'Segundo', 'co_dona', false);
        `);

        await expect(applyDown(client)).rejects.toThrow(
          /household_multi_group down: há pessoa dona de dois ou mais grupos/,
        );
        await client.query('ROLLBACK');
        const created = await client.query(NEW_OBJECTS_SQL);
        expect(created.rows).toHaveLength(6);
      });
    },
    TIMEOUT,
  );

  it(
    'o down.sql desfaz tudo; apagar a linha da migration deixa aplicar de novo; resolve --rolled-back recusa a migration aplicada',
    async () => {
      await withPreviousSchema(async (client, url) => {
        await seed(client);
        const columns = await columnsOf(client);
        const before = await snapshot(client, columns);
        run(['migrate', 'deploy'], url);

        await applyDown(client);

        await expectNoPartialState(client);
        expect(await snapshot(client, columns)).toEqual(before);

        // O aviso do docs/DEPLOY.md: o schema já voltou e o status ainda diz
        // que está tudo aplicado, porque só lê _prisma_migrations.
        expect(run(['migrate', 'status'], url)).toMatch(/up to date/i);

        // O Prisma só aceita --rolled-back em migration que falhou.
        expect(
          runExpectingFailure(
            ['migrate', 'resolve', '--rolled-back', MIGRATION_NAME],
            url,
          ),
        ).toMatch(/not in a failed state/);

        await client.query(
          `DELETE FROM _prisma_migrations WHERE migration_name = $1`,
          [MIGRATION_NAME],
        );
        run(['migrate', 'deploy'], url);
        expect(run(['migrate', 'status'], url)).toMatch(/up to date/i);
        expect((await client.query(NEW_OBJECTS_SQL)).rows).toHaveLength(6);
      });
    },
    TIMEOUT,
  );
});
