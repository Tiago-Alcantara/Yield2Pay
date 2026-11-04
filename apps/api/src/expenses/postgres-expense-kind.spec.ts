/**
 * Módulo: postgres-expense-kind
 * Criado em: 2026-11-03
 * Última atualização: 2026-11-03
 * Intuito: A migration expense_kind_source e o down.sql rodam sobre dados que já existem, num banco descartável, e as consultas de verdade deixam entrada e gasto excluído fora das contas.
 * Sequência: com dados antigos, o backfill marca a origem e nada mais muda; os dois CHECKs recusam o tipo inválido e a categoria errada; o down.sql aborta enquanto houver entrada e, sem entrada, desfaz tudo e deixa aplicar de novo; a lista de meses só soma gasto que conta; o resumo ignora a entrada e o gasto excluído mais antigos e soma as entradas; a entrada e o gasto excluído com o mesmo nome não fazem o gasto novo virar fixo.
 * Só roda com RUN_DB_TESTS=1 e PG_TEST_URL. Cada teste cria o próprio database no mesmo container e apaga no fim.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import type { ActiveMembership } from '../auth/authenticated-request';
import { saoPauloToday } from '../summary/summary.math';
import { SummaryService } from '../summary/summary.service';
import { ExpensesService } from './expenses.service';
import { clearLegacyKeyCache } from './fixed-flags';

const DATABASE_URL =
  process.env.RUN_DB_TESTS === '1' ? process.env.PG_TEST_URL : undefined;
const API_DIR = resolve(__dirname, '../..');
const MIGRATIONS_DIR = resolve(API_DIR, 'prisma/migrations');
const MIGRATION_NAME = '20261103120000_expense_kind_source';
const DOWN_SQL = resolve(MIGRATIONS_DIR, MIGRATION_NAME, 'down.sql');
const TIMEOUT = 180_000;

function prisma(args: string[], databaseUrl: string): string {
  return execFileSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

describe.skipIf(!DATABASE_URL)('migration expense_kind_source', () => {
  if (!DATABASE_URL) return;
  const adminUrl = DATABASE_URL;
  let tempDir = '';
  let previousHistory = '';
  let counter = 0;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'y2p-expense-kind-'));
    previousHistory = join(tempDir, 'migrations');
    cpSync(MIGRATIONS_DIR, previousHistory, { recursive: true });
    rmSync(join(previousHistory, MIGRATION_NAME), { recursive: true });
  });

  afterAll(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  /** Database novo, no schema anterior à migration, com linhas antigas. */
  async function withOldData(
    work: (client: Client, url: string) => Promise<void>,
  ) {
    counter += 1;
    const name = `y2p_kind_${process.pid}_${Date.now()}_${counter}`;
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
        INSERT INTO statements (id, household_id, added_by_company_id, filename, format, content_hash) VALUES
          ('s_1', 'h_1', 'co_1', 'extrato.ofx', 'ofx', 'hash-1');
        INSERT INTO expenses (id, household_id, added_by_company_id, statement_id, spent_on, merchant, category, fixed, amount_cents) VALUES
          ('e_extrato', 'h_1', 'co_1', 's_1', '2026-10-01', 'Mercado', 'groceries', false, 12345),
          ('e_manual', 'h_1', 'co_1', NULL, '2026-10-02', 'Aluguel', 'housing', true, 200000);
      `);
      await work(client, url);
    } finally {
      await client.end().catch(() => undefined);
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    }
  }

  async function constraints(client: Client) {
    const result = await client.query<{
      conname: string;
      convalidated: boolean;
    }>(
      `SELECT conname, convalidated FROM pg_constraint
       WHERE conname LIKE 'expenses_kind%' ORDER BY conname`,
    );
    return result.rows;
  }

  async function newColumns(client: Client) {
    const result = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'expenses'
         AND column_name IN ('kind', 'source', 'excluded_from_totals')
       ORDER BY column_name`,
    );
    return result.rows.map((row) => row.column_name);
  }

  async function categoryIsNullable(client: Client) {
    const result = await client.query<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_name = 'expenses' AND column_name = 'category'`,
    );
    return result.rows[0]?.is_nullable === 'YES';
  }

  function insert(client: Client, kind: string, category: string | null) {
    return client.query(
      `INSERT INTO expenses (id, household_id, added_by_company_id, spent_on, merchant, kind, category, fixed, amount_cents)
       VALUES ($1, 'h_1', 'co_1', '2026-10-03', 'Salário', $2, $3, false, 100)`,
      [`e_${kind}_${category ?? 'nula'}`, kind, category],
    );
  }

  it(
    'com dados antigos, o backfill marca a origem e nada mais muda',
    async () => {
      await withOldData(async (client, url) => {
        const before = await client.query(
          `SELECT id, statement_id, spent_on, merchant, category, fixed, amount_cents
           FROM expenses ORDER BY id`,
        );

        prisma(['migrate', 'deploy'], url);

        const after = await client.query(
          `SELECT id, statement_id, spent_on, merchant, category, fixed, amount_cents
           FROM expenses ORDER BY id`,
        );
        expect(after.rows).toEqual(before.rows);
        const added = await client.query(
          `SELECT id, kind, source, excluded_from_totals FROM expenses ORDER BY id`,
        );
        expect(added.rows).toEqual([
          {
            id: 'e_extrato',
            kind: 'expense',
            source: 'statement',
            excluded_from_totals: false,
          },
          {
            id: 'e_manual',
            kind: 'expense',
            source: 'manual',
            excluded_from_totals: false,
          },
        ]);
        expect(await constraints(client)).toEqual([
          { conname: 'expenses_kind_category_check', convalidated: true },
          { conname: 'expenses_kind_check', convalidated: true },
        ]);
        expect(await categoryIsNullable(client)).toBe(true);
      });
    },
    TIMEOUT,
  );

  it(
    'os dois CHECKs recusam o tipo inválido e a categoria errada',
    async () => {
      await withOldData(async (client, url) => {
        prisma(['migrate', 'deploy'], url);

        await expect(insert(client, 'transfer', null)).rejects.toThrow(
          /expenses_kind_check/,
        );
        await expect(insert(client, 'expense', null)).rejects.toThrow(
          /expenses_kind_category_check/,
        );
        await expect(insert(client, 'income', 'groceries')).rejects.toThrow(
          /expenses_kind_category_check/,
        );

        await insert(client, 'income', null);
        await insert(client, 'expense', 'groceries');
        const rows = await client.query(`SELECT id FROM expenses`);
        expect(rows.rows).toHaveLength(4);
      });
    },
    TIMEOUT,
  );

  it(
    'o down.sql aborta enquanto houver entrada e, sem entrada, desfaz tudo e deixa aplicar de novo',
    async () => {
      await withOldData(async (client, url) => {
        prisma(['migrate', 'deploy'], url);
        await insert(client, 'income', null);
        const down = readFileSync(DOWN_SQL, 'utf8');

        await expect(client.query(down)).rejects.toThrow(
          /expense_kind_source down: há entradas/,
        );
        await client.query('ROLLBACK');
        expect(await newColumns(client)).toEqual([
          'excluded_from_totals',
          'kind',
          'source',
        ]);
        expect(await constraints(client)).toHaveLength(2);
        expect(await categoryIsNullable(client)).toBe(true);

        await client.query(`DELETE FROM expenses WHERE kind = 'income'`);
        await client.query(down);

        expect(await newColumns(client)).toEqual([]);
        expect(await constraints(client)).toEqual([]);
        expect(await categoryIsNullable(client)).toBe(false);
        const kept = await client.query(`SELECT id FROM expenses ORDER BY id`);
        expect(kept.rows).toEqual([{ id: 'e_extrato' }, { id: 'e_manual' }]);

        await client.query(
          `DELETE FROM _prisma_migrations WHERE migration_name = $1`,
          [MIGRATION_NAME],
        );
        prisma(['migrate', 'deploy'], url);
        expect(await newColumns(client)).toHaveLength(3);
        const source = await client.query(
          `SELECT id, source FROM expenses ORDER BY id`,
        );
        expect(source.rows).toEqual([
          { id: 'e_extrato', source: 'statement' },
          { id: 'e_manual', source: 'manual' },
        ]);
      });
    },
    TIMEOUT,
  );
});

describe.skipIf(!DATABASE_URL)('entradas e gastos excluídos no banco', () => {
  if (!DATABASE_URL) return;
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  });
  const stamp = `kind-${Date.now()}`;
  let membership: ActiveMembership;

  const row = (
    spentOn: string,
    merchant: string,
    amountCents: number,
    extra: Record<string, unknown> = {},
  ) => ({
    householdId: membership.householdId,
    addedByCompanyId: membership.companyId,
    spentOn: new Date(`${spentOn}T00:00:00.000Z`),
    merchant,
    category: 'housing',
    fixed: false,
    amountCents,
    merchantKey: merchant.toLowerCase(),
    sharedMerchantKey: merchant.toLowerCase(),
    ...extra,
  });
  const income = (spentOn: string, merchant: string, amountCents: number) =>
    row(spentOn, merchant, amountCents, { kind: 'income', category: null });
  const excluded = (spentOn: string, merchant: string, amountCents: number) =>
    row(spentOn, merchant, amountCents, { excludedFromTotals: true });

  beforeAll(async () => {
    prisma(['migrate', 'deploy'], DATABASE_URL);
    const company = await client.company.create({
      data: { privyUserId: stamp },
    });
    const household = await client.household.create({
      data: { name: 'Casa', ownerCompanyId: company.id, priorities: [] },
    });
    await client.householdMember.create({
      data: {
        householdId: household.id,
        companyId: company.id,
        role: 'owner',
      },
    });
    membership = {
      householdId: household.id,
      companyId: company.id,
      role: 'owner',
      personal: false,
    };
  }, TIMEOUT);

  beforeEach(async () => {
    clearLegacyKeyCache();
    await client.expense.deleteMany({
      where: { householdId: membership.householdId },
    });
  });

  afterAll(async () => {
    await client.expense.deleteMany({
      where: { householdId: membership.householdId },
    });
    await client.householdMember.deleteMany({
      where: { householdId: membership.householdId },
    });
    await client.household.delete({ where: { id: membership.householdId } });
    await client.company.delete({ where: { id: membership.companyId } });
    await client.$disconnect();
  });

  it('a lista de meses só soma gasto que conta', async () => {
    await client.expense.createMany({
      data: [
        row('2026-08-02', 'Aluguel', 1000),
        income('2026-08-03', 'Salário', 900000),
        income('2026-07-03', 'Salário', 900000),
        excluded('2026-06-03', 'Transferência', 900000),
        excluded('2026-08-04', 'Transferência', 900000),
      ],
    });
    const service = new ExpensesService(client as never);

    await expect(service.months(membership)).resolves.toEqual([
      { month: '2026-08', amountCents: 1000 },
    ]);
  });

  it('o resumo ignora a entrada e o gasto excluído mais antigos e soma as entradas', async () => {
    const today = saoPauloToday(new Date()).slice(0, 7);
    const shift = (delta: number) => {
      const [year, month] = today.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1 + delta, 1))
        .toISOString()
        .slice(0, 7);
    };
    await client.expense.createMany({
      data: [
        // Fora da janela da média: mudaria o primeiro mês se contasse.
        income(`${shift(-4)}-01`, 'Salário', 900000),
        excluded(`${shift(-3)}-01`, 'Transferência', 900000),
        row(`${shift(-1)}-01`, 'Aluguel', 3000),
        income(`${today}-01`, 'Salário', 500000),
        row(`${today}-01`, 'Aluguel', 2000),
        excluded(`${today}-01`, 'Transferência', 900000),
      ],
    });
    const service = new SummaryService(client as never);

    const summary = await service.summary(membership, today);

    expect(summary.monthTotalCents).toBe(2000);
    expect(summary.averageCents).toBe(3000);
    expect(summary.incomeCents).toBe(500000);
    expect(summary.balanceCents).toBe(498000);
    expect(summary.byCategory).toEqual([
      { category: 'housing', amountCents: 2000 },
    ]);
  });

  it('a entrada e o gasto excluído com o mesmo nome não fazem o gasto novo virar fixo', async () => {
    await client.expense.createMany({
      data: [
        income('2026-08-02', 'Aluguel', 1000),
        excluded('2026-07-02', 'Aluguel', 1000),
      ],
    });
    const service = new ExpensesService(client as never);

    const created = await service.create(membership, {
      merchant: 'Aluguel',
      amountCents: 1000,
      spentOn: '2026-09-02',
      category: 'housing',
    });

    expect(created.fixed).toBe(false);
    const flagged = await client.expense.count({
      where: { householdId: membership.householdId, fixed: true },
    });
    expect(flagged).toBe(0);
  });
});
