/**
 * Módulo: household-member.guard + active-household
 * Criado em: 2026-11-01
 * Última atualização: 2026-11-01
 * Intuito: O grupo ativo vem do header X-Household-Id ou do padrão da pessoa, e grupo alheio nunca vaza.
 * Sequência: header de grupo alheio dá 404; id malformado dá 404 sem consultar a membership; header de grupo próprio preenche req.membership; sem header usa a única membership; sem header e com dois grupos usa o não individual, em qualquer ordem; com vários não individuais usa a membership mais antiga, com o id de desempate; o guard nunca cria grupo; pessoa sem grupo dá 404; ensurePersonalHousehold cria o individual uma vez e a segunda chamada não cria de novo; quem já tem o individual ou não tem grupo nenhum não ganha grupo; o P2002 do índice parcial conta como grupo já criado.
 */
import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import {
  chooseDefaultMembership,
  ensurePersonalHousehold,
  isWellFormedHouseholdId,
  PERSONAL_HOUSEHOLD_DEFAULT_NAME,
  resolveActiveHousehold,
} from './active-household';
import { HouseholdMemberGuard } from './household-member.guard';
import { HouseholdNotFoundError } from './household.errors';

const PERSONAL_ID = 'cpessoal00000000000000001';
const FAMILY_ID = 'cfamilia00000000000000001';
const FOREIGN_ID = 'calheio000000000000000001';

const OTHER_ID = 'coutro000000000000000001';

type MembershipRow = {
  id: string;
  createdAt: Date;
  householdId: string;
  role: string;
  household: { ownerCompanyId: string; personal: boolean };
};

const personalRow: MembershipRow = {
  id: 'm_individual',
  createdAt: new Date('2026-03-01T00:00:00Z'),
  householdId: PERSONAL_ID,
  role: 'owner',
  household: { ownerCompanyId: 'co_ana', personal: true },
};
const familyRow: MembershipRow = {
  id: 'm_familia',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  householdId: FAMILY_ID,
  role: 'member',
  household: { ownerCompanyId: 'co_bia', personal: true },
};
// O id ordena antes do da família, mas a membership é mais nova: quem decide é a data.
const otherRow: MembershipRow = {
  id: 'm_a_outro',
  createdAt: new Date('2026-02-01T00:00:00Z'),
  householdId: OTHER_ID,
  role: 'member',
  household: { ownerCompanyId: 'co_bia', personal: false },
};

/** Banco em memória: as memberships de co_ana, por householdId. */
function fakePrisma(initialRows: MembershipRow[]) {
  const rows = [...initialRows];
  const prisma = {
    rows,
    householdMember: {
      findMany: vi.fn(async () => [...rows]),
      findUnique: vi.fn(
        async (args: {
          where: { householdId_companyId: { householdId: string } };
        }) =>
          rows.find(
            (row) =>
              row.householdId === args.where.householdId_companyId.householdId,
          ) ?? null,
      ),
      create: vi.fn(
        async (args: { data: { householdId: string; role: string } }) => {
          rows.push({
            id: 'm_novo',
            createdAt: new Date('2026-04-01T00:00:00Z'),
            householdId: args.data.householdId,
            role: args.data.role,
            household: { ownerCompanyId: 'co_ana', personal: true },
          });
          return args.data;
        },
      ),
    },
    household: {
      findFirst: vi.fn(async () => {
        const personal = rows.find(
          (row) =>
            row.household.personal && row.household.ownerCompanyId === 'co_ana',
        );
        return personal ? { id: personal.householdId } : null;
      }),
      create: vi.fn(async () => ({ id: PERSONAL_ID })),
    },
    $queryRaw: vi.fn(async () => [{ locked: 1 }]),
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
      work(prisma),
    ),
  };
  return prisma;
}

function contextFor(req: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('HouseholdMemberGuard', () => {
  it('header de grupo alheio dá 404', async () => {
    const prisma = fakePrisma([personalRow, familyRow]);
    const guard = new HouseholdMemberGuard(prisma as never);
    const req = {
      companyId: 'co_ana',
      headers: { 'x-household-id': FOREIGN_ID },
    };
    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.householdMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          householdId_companyId: {
            householdId: FOREIGN_ID,
            companyId: 'co_ana',
          },
        },
      }),
    );
  });

  it.each([
    'h1',
    'CFAMILIA00000000000000001',
    `${FAMILY_ID}, ${PERSONAL_ID}`,
    '',
    "c' OR 1=1 --00000000000000",
  ])('id malformado %j dá 404 sem consultar a membership', async (value) => {
    const prisma = fakePrisma([personalRow, familyRow]);
    const guard = new HouseholdMemberGuard(prisma as never);
    const req = { companyId: 'co_ana', headers: { 'x-household-id': value } };
    await expect(guard.canActivate(contextFor(req))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.householdMember.findUnique).not.toHaveBeenCalled();
    expect(isWellFormedHouseholdId(value)).toBe(false);
  });

  it('header de grupo próprio preenche req.membership', async () => {
    const prisma = fakePrisma([personalRow, familyRow]);
    const guard = new HouseholdMemberGuard(prisma as never);
    const req: Partial<AuthenticatedRequest> = {
      companyId: 'co_ana',
      headers: { 'x-household-id': FAMILY_ID },
    };
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(req.membership).toEqual({
      householdId: FAMILY_ID,
      companyId: 'co_ana',
      role: 'member',
      personal: false,
    });
  });

  it('sem header usa a única membership', async () => {
    const prisma = fakePrisma([personalRow]);
    const guard = new HouseholdMemberGuard(prisma as never);
    const req: Partial<AuthenticatedRequest> = {
      companyId: 'co_ana',
      headers: {},
    };
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(req.membership).toEqual({
      householdId: PERSONAL_ID,
      companyId: 'co_ana',
      role: 'owner',
      personal: true,
    });
  });

  // As duas ordens: pegar a primeira ou a última linha não passa em ambas.
  it.each([
    ['família primeiro', [familyRow, personalRow]],
    ['individual primeiro', [personalRow, familyRow]],
  ])(
    'sem header e com dois grupos usa o não individual (%s)',
    async (_label, rows) => {
      const prisma = fakePrisma(rows);
      const membership = await resolveActiveHousehold(
        prisma as never,
        'co_ana',
        undefined,
      );
      expect(membership).toEqual({
        householdId: FAMILY_ID,
        companyId: 'co_ana',
        role: 'member',
        personal: false,
      });
    },
  );

  it.each([
    [[familyRow, otherRow, personalRow]],
    [[otherRow, familyRow, personalRow]],
    [[personalRow, otherRow, familyRow]],
    [[personalRow, familyRow, otherRow]],
    [[otherRow, personalRow, familyRow]],
    [[familyRow, personalRow, otherRow]],
  ])(
    'com vários não individuais usa a membership mais antiga',
    async (rows) => {
      const prisma = fakePrisma(rows);
      const membership = await resolveActiveHousehold(
        prisma as never,
        'co_ana',
        undefined,
      );
      expect(membership.householdId).toBe(FAMILY_ID);
    },
  );

  it('na mesma data, o id desempata de forma estável', () => {
    const sameDate = new Date('2026-01-01T00:00:00Z');
    const first = { ...familyRow, id: 'm_a', createdAt: sameDate };
    const second = { ...otherRow, id: 'm_b', createdAt: sameDate };
    expect(chooseDefaultMembership([first, second], 'co_ana')).toBe(first);
    expect(chooseDefaultMembership([second, first], 'co_ana')).toBe(first);
  });

  it('grupo próprio com personal = false conta como não individual', () => {
    const ownShared = {
      ...otherRow,
      household: { ownerCompanyId: 'co_ana', personal: false },
    };
    expect(chooseDefaultMembership([personalRow, ownShared], 'co_ana')).toBe(
      ownShared,
    );
  });

  it('o guard nunca cria grupo, com ou sem header', async () => {
    const prisma = fakePrisma([familyRow]);
    const guard = new HouseholdMemberGuard(prisma as never);
    await guard.canActivate(contextFor({ companyId: 'co_ana', headers: {} }));
    await guard.canActivate(
      contextFor({
        companyId: 'co_ana',
        headers: { 'x-household-id': FAMILY_ID },
      }),
    );
    await expect(
      guard.canActivate(
        contextFor({
          companyId: 'co_ana',
          headers: { 'x-household-id': FOREIGN_ID },
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.household.create).not.toHaveBeenCalled();
  });

  it('pessoa sem grupo dá 404', async () => {
    const prisma = fakePrisma([]);
    await expect(
      resolveActiveHousehold(prisma as never, 'co_ana', undefined),
    ).rejects.toBeInstanceOf(HouseholdNotFoundError);
    const guard = new HouseholdMemberGuard(prisma as never);
    await expect(
      guard.canActivate(contextFor({ companyId: 'co_ana', headers: {} })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.household.create).not.toHaveBeenCalled();
  });
});

describe('ensurePersonalHousehold', () => {
  it('cria o individual uma vez e a segunda chamada não cria de novo', async () => {
    const prisma = fakePrisma([familyRow]);
    await expect(
      ensurePersonalHousehold(prisma as never, 'co_ana'),
    ).resolves.toBe(true);
    await expect(
      ensurePersonalHousehold(prisma as never, 'co_ana'),
    ).resolves.toBe(false);
    expect(prisma.household.create).toHaveBeenCalledTimes(1);
    expect(prisma.household.create).toHaveBeenCalledWith({
      data: {
        name: PERSONAL_HOUSEHOLD_DEFAULT_NAME,
        ownerCompanyId: 'co_ana',
        personal: true,
      },
    });
    expect(prisma.householdMember.create).toHaveBeenCalledWith({
      data: { householdId: PERSONAL_ID, companyId: 'co_ana', role: 'owner' },
    });
    // O lock vem antes da releitura, dentro da transação.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    // Ganhar o individual não tira a pessoa da família.
    const membership = await resolveActiveHousehold(
      prisma as never,
      'co_ana',
      undefined,
    );
    expect(membership.householdId).toBe(FAMILY_ID);
    expect(prisma.household.create).toHaveBeenCalledTimes(1);
  });

  it('quem já tem o individual ou não tem grupo nenhum não ganha grupo', async () => {
    const withPersonal = fakePrisma([personalRow, familyRow]);
    await expect(
      ensurePersonalHousehold(withPersonal as never, 'co_ana'),
    ).resolves.toBe(false);
    expect(withPersonal.$transaction).not.toHaveBeenCalled();

    const withoutGroup = fakePrisma([]);
    await expect(
      ensurePersonalHousehold(withoutGroup as never, 'co_ana'),
    ).resolves.toBe(false);
    expect(withoutGroup.$transaction).not.toHaveBeenCalled();
  });

  it('o P2002 do índice parcial conta como grupo já criado', async () => {
    const prisma = fakePrisma([familyRow]);
    prisma.household.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      ensurePersonalHousehold(prisma as never, 'co_ana'),
    ).resolves.toBe(false);
  });
});
