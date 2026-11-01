/**
 * Módulo: postgres-household
 * Criado em: 2026-11-01
 * Última atualização: 2026-11-01
 * Intuito: Regras de vários grupos no Postgres local: índice parcial, CHECK de role, grupo individual sob concorrência e down.sql.
 * Sequência: o índice parcial barra um segundo individual e deixa um grupo comum; o CHECK recusa role fora de owner/member; o membro antigo ganha exatamente um individual com chamadas concorrentes; o down.sql aborta num banco descartável quando alguém está em dois grupos e desfaz tudo quando ninguém está.
 * Só roda com RUN_DB_TESTS=1 e PG_TEST_URL (o banco descartável da porta 55432).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import {
  ensurePersonalHousehold,
  resolveActiveHousehold,
} from './active-household';
import { HouseholdService } from './household.service';

const DATABASE_URL =
  process.env.RUN_DB_TESTS === '1' ? process.env.PG_TEST_URL : undefined;
const API_DIR = resolve(__dirname, '../..');
const DOWN_SQL_PATH = resolve(
  API_DIR,
  'prisma/migrations/20261101120000_household_multi_group/down.sql',
);

function prismaCli(args: string[], databaseUrl: string): string {
  return execFileSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
}

/** Mesma URL, outro database no mesmo container. */
function urlForDatabase(databaseUrl: string, databaseName: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
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
      resolveActiveHousehold(prisma as never, oldMemberId, undefined),
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
    expect(active.householdId).toBe(personalHouseholds[0]?.id);
    expect(active.role).toBe('owner');
    const account = await service.getAccount(oldMemberId);
    expect(account.households).toHaveLength(2);
    expect(account.activeHousehold?.personal).toBe(true);

    // O dono da família já tinha o individual: nada muda para ele.
    await ensurePersonalHousehold(prisma as never, ownerId);
    expect(
      await prisma.household.count({ where: { ownerCompanyId: ownerId } }),
    ).toBe(1);
  }, 30_000);

  it('o down.sql aborta quando alguém está em dois grupos e desfaz tudo quando ninguém está', async () => {
    const scratchName = `yield2pay_down_${Date.now()}`;
    const scratchUrl = urlForDatabase(databaseUrl, scratchName);
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${scratchName}"`);
    const scratch = new Client({ connectionString: scratchUrl });
    try {
      prismaCli(['migrate', 'deploy'], scratchUrl);
      await scratch.connect();
      await scratch.query(`
        INSERT INTO companies (id, privy_user_id) VALUES ('co_dona', 'p_dona'), ('co_membro', 'p_membro');
        INSERT INTO households (id, name, owner_company_id, personal) VALUES
          ('h_familia', 'Família', 'co_dona', true),
          ('h_membro', 'Meu grupo', 'co_membro', true);
        INSERT INTO household_members (id, household_id, company_id, role) VALUES
          ('m1', 'h_familia', 'co_dona', 'owner'),
          ('m2', 'h_familia', 'co_membro', 'member'),
          ('m3', 'h_membro', 'co_membro', 'owner');
      `);
      const downSql = readFileSync(DOWN_SQL_PATH, 'utf8');

      await expect(scratch.query(downSql)).rejects.toThrow(
        /household_multi_group down: há pessoa em dois ou mais grupos/,
      );
      await scratch.query('ROLLBACK');
      const personalColumn = await scratch.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'households' AND column_name = 'personal'`,
      );
      expect(personalColumn.rowCount).toBe(1);

      // Sem ninguém em dois grupos o down volta ao modelo antigo.
      await scratch.query(`
        DELETE FROM household_members WHERE id = 'm3';
        DELETE FROM households WHERE id = 'h_membro';
      `);
      await scratch.query(downSql);
      const afterColumns = await scratch.query(
        `SELECT column_name FROM information_schema.columns
         WHERE (table_name = 'households' AND column_name = 'personal')
            OR (table_name = 'companies' AND column_name = 'guest_group_limit')`,
      );
      expect(afterColumns.rowCount).toBe(0);
      const afterIndexes = await scratch.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
         WHERE indexname IN (
           'households_owner_company_id_key',
           'household_members_company_id_key',
           'households_owner_company_id_personal_key',
           'household_members_company_id_idx'
         )
         ORDER BY indexname`,
      );
      expect(afterIndexes.rows.map((row) => row.indexname)).toEqual([
        'household_members_company_id_key',
        'households_owner_company_id_key',
      ]);
      const checks = await scratch.query(
        `SELECT 1 FROM pg_constraint WHERE conname = 'household_members_role_check'`,
      );
      expect(checks.rowCount).toBe(0);
    } finally {
      await scratch.end().catch(() => undefined);
      await prisma.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`,
      );
    }
  }, 120_000);
});
