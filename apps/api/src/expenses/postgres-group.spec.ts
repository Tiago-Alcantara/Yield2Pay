/**
 * Módulo: postgres-group
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: Grupo, concorrência, fixo manual e migrate deploy contra o Postgres local.
 * Sequência: dois deploys seguidos; Netflix antiga sai fixa; dois creates ao mesmo tempo concordam.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { applyKeyChanges, previewHouseholdBackfill } from './backfill-preview';
import { ExpensesService } from './expenses.service';
import { StatementsService } from '../statements/statements.service';

const DATABASE_URL =
  'postgresql://yield2pay:yield2pay@127.0.0.1:5432/yield2pay_test?schema=public';
const API_DIR = '/workspace/apps/api';
const MIGRATIONS = `${API_DIR}/prisma/migrations`;

function fileChecksum(name: string): string {
  return createHash('sha256')
    .update(readFileSync(`${MIGRATIONS}/${name}/migration.sql`))
    .digest('hex');
}

function prismaCli(args: string[], databaseUrl = DATABASE_URL): string {
  return execFileSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
}

describe('postgres real', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  });
  const stamp = `round2-${Date.now()}`;
  let companyId = '';
  let householdId = '';

  beforeAll(async () => {
    const checksums = [
      [
        '20261030120000_expense_precomputed_keys',
        fileChecksum('20261030120000_expense_precomputed_keys'),
      ],
      [
        '20261030143000_expense_fixed_manual',
        fileChecksum('20261030143000_expense_fixed_manual'),
      ],
    ] as const;
    for (const [name, checksum] of checksums) {
      await prisma.$executeRaw`
        UPDATE "_prisma_migrations"
        SET "checksum" = ${checksum}
        WHERE "migration_name" = ${name}
          AND "checksum" <> ${checksum}
          AND "finished_at" IS NOT NULL
      `;
    }
    const failed = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT "migration_name"
      FROM "_prisma_migrations"
      WHERE "migration_name" = '20261030150000_expense_shared_key_index_concurrent'
        AND "finished_at" IS NULL
        AND "rolled_back_at" IS NULL
    `;
    if (failed.length > 0) {
      prismaCli([
        'migrate',
        'resolve',
        '--rolled-back',
        '20261030150000_expense_shared_key_index_concurrent',
      ]);
    }
    prismaCli(['migrate', 'deploy']);
    prismaCli(['migrate', 'deploy']);
    const pending = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT "migration_name"
      FROM "_prisma_migrations"
      WHERE "migration_name" LIKE '20261030%'
        AND "finished_at" IS NULL
        AND "rolled_back_at" IS NULL
    `;
    expect(pending).toEqual([]);

    const company = await prisma.company.create({
      data: { privyUserId: stamp },
    });
    companyId = company.id;
    const household = await prisma.household.create({
      data: {
        name: 'Casa da rodada 2',
        ownerCompanyId: company.id,
        priorities: [],
      },
    });
    householdId = household.id;
    await prisma.householdMember.create({
      data: { householdId, companyId, role: 'owner' },
    });
  }, 120_000);

  afterAll(async () => {
    await prisma.expense.deleteMany({ where: { householdId } });
    await prisma.statement.deleteMany({ where: { householdId } });
    await prisma.householdMember.deleteMany({ where: { householdId } });
    await prisma.household.deleteMany({ where: { id: householdId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  function expenses() {
    return new ExpensesService(
      prisma as never,
      {
        requireMembership: async () => ({ householdId, role: 'owner' }),
      } as never,
    );
  }

  it('marca a Netflix nova como fixa quando o histórico antigo não tem chave', async () => {
    const old = await prisma.expense.create({
      data: {
        householdId,
        addedByCompanyId: companyId,
        spentOn: new Date('2026-09-02T00:00:00.000Z'),
        merchant: 'Netflix',
        category: 'subscriptions',
        fixed: false,
        fixedManual: false,
        amountCents: 5590,
        merchantKey: '',
        sharedMerchantKey: '',
      },
    });
    const created = await expenses().create(companyId, {
      merchant: 'Netflix',
      amountCents: 5590,
      spentOn: '2026-10-02',
      category: 'subscriptions',
    });
    expect(created.fixed).toBe(true);
    const stored = await prisma.expense.findUniqueOrThrow({
      where: { id: old.id },
    });
    expect(stored.fixed).toBe(true);
    expect(stored.merchantKey).toBe('netflix');
    expect(stored.sharedMerchantKey).toBe('netflix');
    await prisma.expense.deleteMany({
      where: { householdId, merchant: 'Netflix' },
    });
  });

  it('junta um prefixo diferente ao grupo da Netflix', async () => {
    const old = await prisma.expense.create({
      data: {
        householdId,
        addedByCompanyId: companyId,
        spentOn: new Date('2026-09-03T00:00:00.000Z'),
        merchant: 'Netflix Premium',
        category: 'subscriptions',
        fixed: false,
        amountCents: 5590,
        merchantKey: 'netflix premium',
        sharedMerchantKey: 'netflix premium',
      },
    });
    const created = await expenses().create(companyId, {
      merchant: 'Netflix',
      amountCents: 5590,
      spentOn: '2026-10-03',
      category: 'subscriptions',
    });
    expect(created.fixed).toBe(true);
    const stored = await prisma.expense.findUniqueOrThrow({
      where: { id: old.id },
    });
    expect(stored.fixed).toBe(true);
    expect(stored.sharedMerchantKey).toBe('netflix');
    await prisma.expense.deleteMany({
      where: { id: { in: [old.id, created.id] } },
    });
  });

  it('preserva fixed=false marcado à mão quando o grupo ganha outra despesa', async () => {
    const hand = await prisma.expense.create({
      data: {
        householdId,
        addedByCompanyId: companyId,
        spentOn: new Date('2026-08-04T00:00:00.000Z'),
        merchant: 'Aluguel',
        category: 'housing',
        fixed: true,
        fixedManual: false,
        amountCents: 250000,
        merchantKey: 'aluguel',
        sharedMerchantKey: 'aluguel',
      },
    });
    await prisma.expense.create({
      data: {
        householdId,
        addedByCompanyId: companyId,
        spentOn: new Date('2026-09-04T00:00:00.000Z'),
        merchant: 'Aluguel',
        category: 'housing',
        fixed: true,
        fixedManual: false,
        amountCents: 250000,
        merchantKey: 'aluguel',
        sharedMerchantKey: 'aluguel',
      },
    });
    const patched = await expenses().patch(companyId, hand.id, {
      fixed: false,
    });
    expect(patched.fixed).toBe(false);
    const created = await expenses().create(companyId, {
      merchant: 'Aluguel',
      amountCents: 250000,
      spentOn: '2026-10-04',
      category: 'housing',
    });
    expect(created.fixed).toBe(true);
    const stored = await prisma.expense.findUniqueOrThrow({
      where: { id: hand.id },
    });
    expect(stored.fixed).toBe(false);
    expect(stored.fixedManual).toBe(true);
    await prisma.expense.deleteMany({
      where: { householdId, merchant: 'Aluguel' },
    });
  });

  it('dois creates simultâneos do mesmo grupo concordam no fixo', async () => {
    const svc = expenses();
    for (let round = 0; round < 5; round += 1) {
      const merchant = `Spotify ${round}`;
      const [first, second] = await Promise.all([
        svc.create(companyId, {
          merchant,
          amountCents: 2190,
          spentOn: '2026-09-06',
          category: 'subscriptions',
        }),
        svc.create(companyId, {
          merchant,
          amountCents: 2190,
          spentOn: '2026-10-06',
          category: 'subscriptions',
        }),
      ]);
      const rows = await prisma.expense.findMany({
        where: { householdId, merchant },
      });
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.fixed)).toBe(true);
      expect([first.id, second.id].sort()).toEqual(
        rows.map((row) => row.id).sort(),
      );
      await prisma.expense.deleteMany({ where: { householdId, merchant } });
    }
  });

  it('dois imports simultâneos do mesmo grupo concordam no fixo', async () => {
    const statements = new StatementsService(
      prisma as never,
      {
        requireMembership: async () => ({ householdId, role: 'owner' }),
      } as never,
    );
    await Promise.all([
      statements.importFile(
        companyId,
        'set.csv',
        Buffer.from('data,descricao,valor\n01/09/2026,Disney Plus,33.90\n'),
      ),
      statements.importFile(
        companyId,
        'out.csv',
        Buffer.from('data,descricao,valor\n01/10/2026,Disney Plus,33.90\n'),
      ),
    ]);
    const rows = await prisma.expense.findMany({
      where: { householdId, merchant: 'Disney Plus' },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.fixed)).toBe(true);
    await prisma.expense.deleteMany({
      where: { householdId, merchant: 'Disney Plus' },
    });
    await prisma.statement.deleteMany({ where: { householdId } });
  });

  it('o backfill não apaga fixed=true e a segunda gravação não muda nada', async () => {
    const row = await prisma.expense.create({
      data: {
        householdId,
        addedByCompanyId: companyId,
        spentOn: new Date('2026-10-08T00:00:00.000Z'),
        merchant: 'Padaria Unica',
        category: 'groceries',
        fixed: true,
        fixedManual: false,
        amountCents: 1800,
        merchantKey: '',
        sharedMerchantKey: '',
      },
    });
    const stored = {
      id: row.id,
      merchant: row.merchant,
      spentOn: '2026-10-08',
      amountCents: row.amountCents,
      category: row.category,
      fixed: row.fixed,
      fixedManual: row.fixedManual,
      merchantKey: row.merchantKey,
      sharedMerchantKey: row.sharedMerchantKey,
    };
    const first = previewHouseholdBackfill([stored]);
    expect(first.every((change) => change.fixed !== false)).toBe(true);
    await applyKeyChanges(prisma, first, 50);
    const after = await prisma.expense.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(after.fixed).toBe(true);
    expect(after.merchantKey).toBe('padaria unica');
    const second = previewHouseholdBackfill([
      {
        ...stored,
        merchantKey: after.merchantKey,
        sharedMerchantKey: after.sharedMerchantKey,
        fixed: after.fixed,
      },
    ]);
    expect(second).toEqual([]);
    await prisma.expense.delete({ where: { id: row.id } });
  });

  it('uma NETFLIX nova fica fixa com histórico NETFLIX.COM sem chave', async () => {
    await prisma.expense.create({
      data: {
        householdId,
        addedByCompanyId: companyId,
        spentOn: new Date('2026-09-11T00:00:00.000Z'),
        merchant: 'NETFLIX.COM',
        category: 'subscriptions',
        fixed: false,
        amountCents: 5590,
        merchantKey: '',
        sharedMerchantKey: '',
      },
    });
    const created = await expenses().create(companyId, {
      merchant: 'Netflix',
      amountCents: 5590,
      spentOn: '2026-10-11',
      category: 'subscriptions',
    });
    expect(created.fixed).toBe(true);
    const legacy = await prisma.expense.findFirstOrThrow({
      where: { householdId, merchant: 'NETFLIX.COM' },
    });
    expect(legacy.fixed).toBe(true);
    expect(legacy.merchantKey).toBe('netflix com');
    expect(legacy.sharedMerchantKey).toBe('netflix');
    await prisma.expense.deleteMany({
      where: { householdId, merchant: { in: ['NETFLIX.COM', 'Netflix'] } },
    });
  });

  it('a leitura sem backfill mostra o fixo antigo das linhas sem chave', async () => {
    await prisma.expense.createMany({
      data: ['2026-09-12', '2026-10-12'].map((day) => ({
        householdId,
        addedByCompanyId: companyId,
        spentOn: new Date(`${day}T00:00:00.000Z`),
        merchant: 'Spotify',
        category: 'subscriptions',
        fixed: false,
        amountCents: 2190,
        merchantKey: '',
        sharedMerchantKey: '',
      })),
    });
    const page = await expenses().list(companyId, '2026-10');
    const shown = page.items.find((item) => item.merchant === 'Spotify');
    expect(shown?.fixed).toBe(true);
    const stored = await prisma.expense.findMany({
      where: { householdId, merchant: 'Spotify' },
    });
    expect(
      stored.every((row) => row.merchantKey === '' && row.fixed === false),
    ).toBe(true);
    await prisma.expense.deleteMany({
      where: { householdId, merchant: 'Spotify' },
    });
  });

  it('mede dez creates simultâneos', async () => {
    const svc = expenses();
    const rounds: number[] = [];
    for (let round = 0; round < 5; round += 1) {
      const durations: number[] = [];
      await Promise.all(
        Array.from({ length: 10 }, async (_, index) => {
          const started = performance.now();
          await svc.create(companyId, {
            merchant: `Bench ${round}-${index}`,
            amountCents: 1000 + index,
            spentOn: '2026-10-15',
            category: 'shopping',
          });
          durations.push(performance.now() - started);
        }),
      );
      durations.sort((left, right) => left - right);
      const p95 = durations[Math.ceil(0.95 * durations.length) - 1] ?? 0;
      rounds.push(p95);
      await prisma.expense.deleteMany({
        where: { householdId, merchant: { startsWith: `Bench ${round}-` } },
      });
    }
    const sameGroup: number[] = [];
    const durations: number[] = [];
    await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        const month = String(index + 1).padStart(2, '0');
        const started = performance.now();
        await svc.create(companyId, {
          merchant: 'Hbo Max',
          amountCents: 3490,
          spentOn: `2026-${month}-02`,
          category: 'subscriptions',
        });
        durations.push(performance.now() - started);
      }),
    );
    durations.sort((left, right) => left - right);
    sameGroup.push(durations[Math.ceil(0.95 * durations.length) - 1] ?? 0);
    const fixed = await prisma.expense.count({
      where: { householdId, merchant: 'Hbo Max', fixed: true },
    });
    expect(fixed).toBe(10);
    await prisma.expense.deleteMany({
      where: { householdId, merchant: 'Hbo Max' },
    });
    console.log(
      JSON.stringify({
        p95MsDistinctMerchants: rounds.map((value) => Math.round(value)),
        p95MsSameGroup: Math.round(sameGroup[0] ?? 0),
      }),
    );
  }, 60_000);
});
