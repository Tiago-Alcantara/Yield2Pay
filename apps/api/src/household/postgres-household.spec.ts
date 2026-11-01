/**
 * Módulo: postgres-household
 * Criado em: 2026-11-01
 * Última atualização: 2026-11-01
 * Intuito: Regras de vários grupos no Postgres local: índice parcial, CHECK de role, grupo individual sob concorrência e grupo padrão.
 * Sequência: o índice parcial barra um segundo individual e deixa um grupo comum; o CHECK recusa role fora de owner/member; o membro antigo ganha exatamente um individual com chamadas concorrentes e continua na família; com vários grupos não individuais, o padrão é o mais antigo pela membership.
 * A migration e o down.sql estão em household-migration.spec.ts.
 * Só roda com RUN_DB_TESTS=1 e PG_TEST_URL (o banco descartável da porta 55432).
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  ensurePersonalHousehold,
  resolveActiveHousehold,
} from './active-household';
import { HouseholdService } from './household.service';

const DATABASE_URL =
  process.env.RUN_DB_TESTS === '1' ? process.env.PG_TEST_URL : undefined;
const API_DIR = resolve(__dirname, '../..');

function prismaCli(args: string[], databaseUrl: string): string {
  return execFileSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
}

describe.skipIf(!DATABASE_URL)('postgres real: vários grupos', () => {
  if (!DATABASE_URL) return;
  const databaseUrl = DATABASE_URL;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const stamp = `grupos-${Date.now()}`;
  const companyIds: string[] = [];

  async function createCompany(label: string) {
    const company = await prisma.company.create({
      data: { privyUserId: `${stamp}-${label}` },
    });
    companyIds.push(company.id);
    return company.id;
  }

  beforeAll(() => {
    prismaCli(['migrate', 'deploy'], databaseUrl);
  }, 120_000);

  afterAll(async () => {
    const households = await prisma.household.findMany({
      where: { ownerCompanyId: { in: companyIds } },
      select: { id: true },
    });
    const householdIds = households.map((household) => household.id);
    await prisma.householdMember.deleteMany({
      where: {
        OR: [
          { householdId: { in: householdIds } },
          { companyId: { in: companyIds } },
        ],
      },
    });
    await prisma.household.deleteMany({ where: { id: { in: householdIds } } });
    await prisma.personName.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.$disconnect();
  });

  it('o índice parcial barra um segundo individual e deixa um grupo comum', async () => {
    const ownerId = await createCompany('dona');
    await prisma.household.create({
      data: { name: 'Individual', ownerCompanyId: ownerId, personal: true },
    });
    await expect(
      prisma.household.create({
        data: {
          name: 'Outro individual',
          ownerCompanyId: ownerId,
          personal: true,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    const shared = await prisma.household.create({
      data: { name: 'Grupo comum', ownerCompanyId: ownerId, personal: false },
    });
    expect(shared.personal).toBe(false);
    const indexes = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes
      WHERE indexname = 'households_owner_company_id_personal_key'
    `;
    expect(indexes[0]?.indexdef).toContain('WHERE personal');
  });

  it('o CHECK recusa role fora de owner/member', async () => {
    const ownerId = await createCompany('check');
    const household = await prisma.household.create({
      data: { name: 'Check', ownerCompanyId: ownerId, personal: true },
    });
    await expect(
      prisma.householdMember.create({
        data: { householdId: household.id, companyId: ownerId, role: 'admin' },
      }),
    ).rejects.toThrow(/household_members_role_check|check constraint/i);
    const member = await prisma.householdMember.create({
      data: { householdId: household.id, companyId: ownerId, role: 'owner' },
    });
    expect(member.role).toBe('owner');
  });

  it('o membro antigo ganha exatamente um individual com chamadas concorrentes', async () => {
    const ownerId = await createCompany('familia-dona');
    const oldMemberId = await createCompany('membro-antigo');
    const family = await prisma.household.create({
      data: { name: 'Família', ownerCompanyId: ownerId, personal: true },
    });
    await prisma.householdMember.createMany({
      data: [
        { householdId: family.id, companyId: ownerId, role: 'owner' },
        { householdId: family.id, companyId: oldMemberId, role: 'member' },
      ],
    });

    const service = new HouseholdService(prisma as never);
    const results = await Promise.all([
      ensurePersonalHousehold(prisma as never, oldMemberId),
      ensurePersonalHousehold(prisma as never, oldMemberId),
      service.getAccount(oldMemberId),
      service.getAccount(oldMemberId),
      ensurePersonalHousehold(prisma as never, oldMemberId),
    ]);

    const personalHouseholds = await prisma.household.findMany({
      where: { ownerCompanyId: oldMemberId, personal: true },
    });
    expect(personalHouseholds).toHaveLength(1);
    const memberships = await prisma.householdMember.findMany({
      where: { companyId: oldMemberId },
    });
    expect(memberships).toHaveLength(2);
    const createdFlags = [results[0], results[1], results[4]];
    expect(
      createdFlags.filter((created) => created === true).length,
    ).toBeLessThanOrEqual(1);

    const active = await resolveActiveHousehold(
      prisma as never,
      oldMemberId,
      undefined,
    );
    expect(active.householdId).toBe(family.id);
    expect(active.role).toBe('member');
    const account = await service.getAccount(oldMemberId);
    expect(account.households).toHaveLength(2);
    expect(account.activeHousehold?.id).toBe(family.id);
    expect(account.activeHousehold?.personal).toBe(false);

    // O dono da família já tinha o individual: nada muda para ele.
    await ensurePersonalHousehold(prisma as never, ownerId);
    expect(
      await prisma.household.count({ where: { ownerCompanyId: ownerId } }),
    ).toBe(1);
  }, 30_000);

  it('com vários grupos não individuais, o padrão é o mais antigo pela membership', async () => {
    const personId = await createCompany('varios-grupos');
    const ownerId = await createCompany('varios-dono');
    await prisma.household
      .create({
        data: { name: 'Meu', ownerCompanyId: personId, personal: true },
      })
      .then((own) =>
        prisma.householdMember.create({
          data: { householdId: own.id, companyId: personId, role: 'owner' },
        }),
      );
    const newer = await prisma.household.create({
      data: { name: 'Mais novo', ownerCompanyId: ownerId, personal: false },
    });
    const older = await prisma.household.create({
      data: { name: 'Mais antigo', ownerCompanyId: ownerId, personal: false },
    });
    // O grupo mais antigo é inserido por último, para não coincidir com a
    // ordem física das linhas.
    await prisma.householdMember.create({
      data: {
        householdId: newer.id,
        companyId: personId,
        role: 'member',
        createdAt: new Date('2026-06-01T00:00:00Z'),
      },
    });
    await prisma.householdMember.create({
      data: {
        householdId: older.id,
        companyId: personId,
        role: 'member',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    });

    const active = await resolveActiveHousehold(
      prisma as never,
      personId,
      undefined,
    );
    expect(active.householdId).toBe(older.id);
    expect(active.personal).toBe(false);
  });
});
