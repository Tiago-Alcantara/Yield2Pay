/**
 * Módulo: postgres-wallet-migration
 * Criado em: 2026-11-04
 * Última atualização: 2026-11-04
 * Intuito: A migration household_wallets e o down.sql rodam sobre dados que já existem, num banco descartável, sem deixar estado parcial.
 * Sequência: é aditiva e nada muda nas linhas antigas; o unique recusa carteira repetida, com e sem muxed; os CHECKs recusam rede, classe e direção inválidas; apagar a carteira leva os movimentos e apagar a linha de expenses só solta o vínculo; falha no boot não deixa estado parcial e cai em P3009 até o migrate resolve; o down.sql apaga as linhas da carteira, o status engana até apagar a linha de _prisma_migrations e a migration aplica de novo.
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
const MIGRATION_NAME = '20261104120000_household_wallets';
const DOWN_SQL = resolve(MIGRATIONS_DIR, MIGRATION_NAME, 'down.sql');
const TIMEOUT = 180_000;
const NEW_TABLES = [
  'asset_price_daily',
  'household_wallets',
  'wallet_movements',
];

function prisma(args: string[], databaseUrl: string): string {
  return execFileSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function prismaExpectingFailure(args: string[], databaseUrl: string): string {
  try {
    prisma(args, databaseUrl);
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
  }
  throw new Error(`prisma ${args.join(' ')} deveria ter falhado`);
}

describe.skipIf(!DATABASE_URL)('migration household_wallets', () => {
  if (!DATABASE_URL) return;
  const adminUrl = DATABASE_URL;
  let tempDir = '';
  let previousHistory = '';
  let counter = 0;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'y2p-wallets-'));
    previousHistory = join(tempDir, 'migrations');
    cpSync(MIGRATIONS_DIR, previousHistory, { recursive: true });
    for (const entry of readdirSync(previousHistory)) {
      if (/^\d/.test(entry) && entry >= MIGRATION_NAME) {
        rmSync(join(previousHistory, entry), { recursive: true });
      }
    }
  });

  afterAll(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  async function withOldData(
    work: (client: Client, url: string) => Promise<void>,
  ) {
    counter += 1;
    const name = `y2p_wallets_${process.pid}_${Date.now()}_${counter}`;
    const target = new URL(adminUrl);
    target.pathname = `/${name}`;
    const url = target.toString();
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    const client = new Client({ connectionString: url });
    try {
      const config = join(tempDir, `${name}.config.ts`);
      writeFileSync(
        config,
        `export default ${JSON.stringify({
          schema: resolve(API_DIR, 'prisma/schema.prisma'),
          migrations: { path: previousHistory },
          datasource: { url },
        })};\n`,
      );
      prisma(['migrate', 'deploy', '--config', config], url);
      await client.connect();
      await client.query(`
        INSERT INTO companies (id, privy_user_id) VALUES ('co_1', 'p_1');
        INSERT INTO households (id, name, owner_company_id, priorities) VALUES ('h_1', 'Casa', 'co_1', '{}');
        INSERT INTO expenses (id, household_id, added_by_company_id, spent_on, merchant, category, fixed, amount_cents) VALUES
          ('e_manual', 'h_1', 'co_1', '2026-10-02', 'Aluguel', 'housing', true, 200000);
      `);
      await work(client, url);
    } finally {
      await client.end().catch(() => undefined);
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    }
  }

  async function tables(client: Client) {
    const result = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1)
       ORDER BY table_name`,
      [NEW_TABLES],
    );
    return result.rows.map((row) => row.table_name);
  }

  function insertWallet(
    client: Client,
    id: string,
    muxedId: string | null,
    network = 'public',
  ) {
    return client.query(
      `INSERT INTO household_wallets (id, household_id, added_by_company_id, network, account_id, muxed_id, label)
       VALUES ($1, 'h_1', 'co_1', $2, 'GCONTA', $3, 'Apelido')`,
      [id, network, muxedId],
    );
  }

  function insertMovement(
    client: Client,
    id: string,
    extra: { direction?: string; class?: string; expenseId?: string } = {},
  ) {
    return client.query(
      `INSERT INTO wallet_movements (id, wallet_id, op_id, tx_hash, occurred_on, op_type, direction, class, expense_id)
       VALUES ($1, 'w_1', $1, 'hash', '2026-10-02', 'payment', $2, $3, $4)`,
      [
        id,
        extra.direction ?? 'in',
        extra.class ?? 'income',
        extra.expenseId ?? null,
      ],
    );
  }

  it(
    'é aditiva e nada muda nas linhas antigas',
    async () => {
      await withOldData(async (client, url) => {
        const before = await client.query(`SELECT * FROM expenses ORDER BY id`);
        prisma(['migrate', 'deploy'], url);
        const after = await client.query(`SELECT * FROM expenses ORDER BY id`);
        expect(after.rows).toEqual(before.rows);
        expect(await tables(client)).toEqual(NEW_TABLES);
        expect(prisma(['migrate', 'status'], url)).toMatch(/up to date/i);
      });
    },
    TIMEOUT,
  );

  it(
    'o unique recusa carteira repetida, com e sem muxed',
    async () => {
      await withOldData(async (client, url) => {
        prisma(['migrate', 'deploy'], url);
        await insertWallet(client, 'w_1', null);
        await expect(insertWallet(client, 'w_2', null)).rejects.toThrow(
          /household_wallets_no_muxed_key/,
        );
        await insertWallet(client, 'w_3', '7');
        await expect(insertWallet(client, 'w_4', '7')).rejects.toThrow(
          /household_wallets_household_id_network_account_id_muxed_id_key/,
        );
        await insertWallet(client, 'w_5', '8');
        await insertWallet(client, 'w_6', null, 'testnet');
      });
    },
    TIMEOUT,
  );

  it(
    'os CHECKs recusam rede, classe e direção inválidas',
    async () => {
      await withOldData(async (client, url) => {
        prisma(['migrate', 'deploy'], url);
        await expect(
          insertWallet(client, 'w_x', null, 'mainnet'),
        ).rejects.toThrow(/household_wallets_network_check/);
        await insertWallet(client, 'w_1', null);
        await expect(
          insertMovement(client, 'm_1', { class: 'transfer' }),
        ).rejects.toThrow(/wallet_movements_class_check/);
        await expect(
          insertMovement(client, 'm_2', { direction: 'up' }),
        ).rejects.toThrow(/wallet_movements_direction_check/);
      });
    },
    TIMEOUT,
  );

  it(
    'apagar a carteira leva os movimentos e apagar a linha de expenses só solta o vínculo',
    async () => {
      await withOldData(async (client, url) => {
        prisma(['migrate', 'deploy'], url);
        await insertWallet(client, 'w_1', null);
        await client.query(`
          INSERT INTO expenses (id, household_id, added_by_company_id, spent_on, merchant, kind, category, fixed, amount_cents, source)
          VALUES ('e_wallet', 'h_1', 'co_1', '2026-10-02', 'Carteira', 'income', NULL, false, 100, 'wallet');
        `);
        await insertMovement(client, 'm_1', { expenseId: 'e_wallet' });

        await client.query(`DELETE FROM expenses WHERE id = 'e_wallet'`);
        const loose = await client.query(
          `SELECT expense_id FROM wallet_movements WHERE id = 'm_1'`,
        );
        expect(loose.rows).toEqual([{ expense_id: null }]);

        await client.query(`DELETE FROM household_wallets WHERE id = 'w_1'`);
        const gone = await client.query(`SELECT id FROM wallet_movements`);
        expect(gone.rows).toEqual([]);
      });
    },
    TIMEOUT,
  );

  it(
    'falha no boot não deixa estado parcial e cai em P3009 até o migrate resolve',
    async () => {
      await withOldData(async (client, url) => {
        // O lock preso esbarra no primeiro ALTER com FK, depois dos CREATE TABLE.
        const holder = new Client({ connectionString: url });
        await holder.connect();
        let failure = '';
        try {
          await holder.query('BEGIN');
          await holder.query(
            `SET LOCAL idle_in_transaction_session_timeout = '20s'`,
          );
          await holder.query('LOCK TABLE households IN ACCESS EXCLUSIVE MODE');
          failure = prismaExpectingFailure(['migrate', 'deploy'], url);
        } finally {
          await holder.end().catch(() => undefined);
        }
        // O BEGIN mascara o erro real: o Prisma tenta gravar a falha na mesma conexão.
        expect(failure).toMatch(/current transaction is aborted/);

        expect(await tables(client)).toEqual([]);
        const rows = await client.query<{ finished_at: Date | null }>(
          `SELECT finished_at FROM _prisma_migrations WHERE migration_name = $1`,
          [MIGRATION_NAME],
        );
        expect(rows.rows).toEqual([{ finished_at: null }]);

        expect(prismaExpectingFailure(['migrate', 'deploy'], url)).toContain(
          'P3009',
        );
        expect(prismaExpectingFailure(['migrate', 'status'], url)).toContain(
          MIGRATION_NAME,
        );

        prisma(['migrate', 'resolve', '--rolled-back', MIGRATION_NAME], url);
        prisma(['migrate', 'deploy'], url);
        expect(await tables(client)).toEqual(NEW_TABLES);
        expect(prisma(['migrate', 'status'], url)).toMatch(/up to date/i);
      });
    },
    TIMEOUT,
  );

  it(
    'o down.sql apaga as linhas da carteira, o status engana até apagar a linha da migration, e ela aplica de novo',
    async () => {
      await withOldData(async (client, url) => {
        prisma(['migrate', 'deploy'], url);
        await insertWallet(client, 'w_1', null);
        await client.query(`
          INSERT INTO expenses (id, household_id, added_by_company_id, spent_on, merchant, kind, category, fixed, amount_cents, source, excluded_from_totals)
          VALUES ('e_wallet', 'h_1', 'co_1', '2026-10-02', 'Carteira', 'expense', 'shopping', false, 100, 'wallet', true);
        `);

        await client.query(readFileSync(DOWN_SQL, 'utf8'));

        expect(await tables(client)).toEqual([]);
        const kept = await client.query(`SELECT id FROM expenses`);
        expect(kept.rows).toEqual([{ id: 'e_manual' }]);

        // O schema já voltou e o status ainda diz que está tudo aplicado.
        expect(prisma(['migrate', 'status'], url)).toMatch(/up to date/i);
        expect(
          prismaExpectingFailure(
            ['migrate', 'resolve', '--rolled-back', MIGRATION_NAME],
            url,
          ),
        ).toMatch(/not in a failed state/);

        await client.query(
          `DELETE FROM _prisma_migrations WHERE migration_name = $1`,
          [MIGRATION_NAME],
        );
        prisma(['migrate', 'deploy'], url);
        expect(await tables(client)).toEqual(NEW_TABLES);
        expect(prisma(['migrate', 'status'], url)).toMatch(/up to date/i);
      });
    },
    TIMEOUT,
  );

  it(
    'o roteiro do docs/DEPLOY.md volta as duas migrations, na ordem',
    async () => {
      await withOldData(async (client, url) => {
        prisma(['migrate', 'deploy'], url);
        await insertWallet(client, 'w_1', null);
        await client.query(`
          INSERT INTO expenses (id, household_id, added_by_company_id, spent_on, merchant, kind, category, fixed, amount_cents, source, excluded_from_totals) VALUES
            ('e_entrada', 'h_1', 'co_1', '2026-10-02', 'Salário', 'income', NULL, false, 100, 'manual', false),
            ('e_wallet', 'h_1', 'co_1', '2026-10-02', 'Carteira', 'expense', 'shopping', false, 100, 'wallet', false),
            ('e_fora', 'h_1', 'co_1', '2026-10-02', 'Fora', 'expense', 'shopping', false, 100, 'manual', true);
        `);
        const kindDown = readFileSync(
          resolve(
            MIGRATIONS_DIR,
            '20261103120000_expense_kind_source',
            'down.sql',
          ),
          'utf8',
        );

        // Fora de ordem, o down dos tipos aborta.
        await expect(client.query(kindDown)).rejects.toThrow(
          /expense_kind_source down/,
        );
        await client.query('ROLLBACK');

        await client.query(readFileSync(DOWN_SQL, 'utf8'));
        await client.query(
          `DELETE FROM expenses WHERE kind = 'income' OR excluded_from_totals`,
        );
        await client.query(kindDown);
        await client.query(
          `DELETE FROM _prisma_migrations WHERE migration_name IN ('20261104120000_household_wallets', '20261103120000_expense_kind_source')`,
        );

        const kept = await client.query(`SELECT id FROM expenses`);
        expect(kept.rows).toEqual([{ id: 'e_manual' }]);
        expect(await tables(client)).toEqual([]);

        prisma(['migrate', 'deploy'], url);
        expect(await tables(client)).toEqual(NEW_TABLES);
        expect(prisma(['migrate', 'status'], url)).toMatch(/up to date/i);
      });
    },
    TIMEOUT,
  );
});
