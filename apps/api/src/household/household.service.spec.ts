/**
 * Módulo: household.service
 * Criado em: 2026-10-19
 * Última atualização: 2026-11-01
 * Intuito: Conta, perfil, onboarding e saída do grupo seguem as regras da casa.
 * Sequência: creates a household and an owner membership; rejects a second household for the same person; lets an old member without a personal group create one; returns initials from the name shown, keeping an emoji whole; lists every group of an old member with the family active; creates the personal group once, only on GET /account without the header; rejects an empty name, a name past 32 characters, an email change, and a role; blocks the last admin from leaving the group; putProfile marks onboarding complete; skip only sets onboardingCompleted; rejects a profile goal that is not 6, 12, 24 or 60 months; rejects a negative income and an unknown crypto experience; patch beginner does not change onboardingCompleted; lets only the owner invite, and blocks someone already in a group; accepts a pending invite when the Google email matches and the person is free; rejects accept when the person already belongs to a group; saves the name shown on the platform; blocks a member from renaming the group; removes a member by the composite key of the active group; completes onboarding without changing income, reserve, or goal months; drops crypto actions when the person has not bought crypto; rejects an unknown goal and writes nothing; uses the first name when the nickname is empty.
 */
import type { ActiveMembership } from '../auth/authenticated-request';
import {
  HouseholdService,
  initialsOf,
  readDisplayNamePatch,
} from './household.service';
import {
  HouseholdConflictError,
  HouseholdForbiddenError,
  HouseholdInvalidError,
} from './household.errors';

// Formato de id do cuid(): o resolveActiveHousehold recusa ids como 'h1'.
const HOUSEHOLD_ID = 'chousehold0000000000000001';
const FAMILY_HOUSEHOLD_ID = 'cfamilia00000000000000001';

function fakePrisma() {
  const prisma = {
    householdMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    household: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    personName: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    householdInvite: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ locked: 1 }]),
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
      work(prisma),
    ),
  };
  return prisma;
}

/** Consulta da regra do convite antigo: só o individual próprio vazio não conta. */
function groupOutsideEmptyPersonal(companyId: string) {
  return {
    where: {
      companyId,
      NOT: {
        household: {
          personal: true,
          ownerCompanyId: companyId,
          members: { none: { companyId: { not: companyId } } },
        },
      },
    },
    select: { id: true },
  };
}

/** Grupo ativo que o HouseholdMemberGuard entregaria ao controller. */
function memberOf(
  role: 'owner' | 'member',
  companyId = 'co_1',
): ActiveMembership {
  return {
    householdId: HOUSEHOLD_ID,
    companyId,
    role,
    personal: role === 'owner',
  };
}

/** A pessoa co_1 é dona só do próprio grupo individual (HOUSEHOLD_ID). */
function ownsPersonalHousehold(prisma: ReturnType<typeof fakePrisma>) {
  const row = {
    id: 'm_casa',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    householdId: HOUSEHOLD_ID,
    role: 'owner',
    household: {
      id: HOUSEHOLD_ID,
      name: 'Casa',
      ownerCompanyId: 'co_1',
      personal: true,
      onboardingCompleted: true,
    },
  };
  prisma.householdMember.findMany.mockResolvedValue([row]);
  prisma.householdMember.findUnique.mockResolvedValue(row);
}

describe('HouseholdService', () => {
  it('creates a household and an owner membership', async () => {
    const prisma = fakePrisma();
    prisma.household.create.mockResolvedValue({ id: 'h1', name: 'Casa 1' });
    const svc = new HouseholdService(prisma as never);
    const created = await svc.create('co_1', 'Casa 1');
    expect(created).toEqual({
      id: 'h1',
      name: 'Casa 1',
      role: 'owner',
      personal: true,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.household.create).toHaveBeenCalledWith({
      data: { name: 'Casa 1', ownerCompanyId: 'co_1', personal: true },
    });
    expect(prisma.householdMember.create).toHaveBeenCalledWith({
      data: { householdId: 'h1', companyId: 'co_1', role: 'owner' },
    });
  });

  it('rejects a second household for the same person', async () => {
    const prisma = fakePrisma();
    prisma.household.findFirst.mockResolvedValue({ id: HOUSEHOLD_ID });
    const svc = new HouseholdService(prisma as never);
    await expect(svc.create('co_1', 'Outra')).rejects.toBeInstanceOf(
      HouseholdConflictError,
    );
    expect(prisma.household.findFirst).toHaveBeenCalledWith({
      where: { ownerCompanyId: 'co_1', personal: true },
      select: { id: true },
    });
    expect(prisma.household.create).not.toHaveBeenCalled();
  });

  it('lets an old member without a personal group create one', async () => {
    const prisma = fakePrisma();
    prisma.household.create.mockResolvedValue({ id: 'h2', name: 'Minha' });
    const svc = new HouseholdService(prisma as never);
    const created = await svc.create('co_1', 'Minha');
    expect(created.personal).toBe(true);
    expect(prisma.household.create).toHaveBeenCalledTimes(1);
  });

  it('returns initials from the name shown, keeping an emoji whole', async () => {
    const prisma = fakePrisma();
    prisma.personName.findUnique.mockResolvedValue({
      displayName: 'Zé 😀',
      fullName: 'Tiago Alcântara',
    });
    const svc = new HouseholdService(prisma as never);
    const account = await svc.getAccount('co_1');
    expect(account.initials).toBe('Z😀');
    expect(account.households).toEqual([]);
    expect(account.activeHousehold).toBeNull();
    expect(initialsOf('Ana Lima', null)).toBe('AL');
    expect(initialsOf(null, '')).toBe('?');
  });

  it('lists every group of an old member with the family active', async () => {
    const prisma = fakePrisma();
    prisma.personName.findUnique.mockResolvedValue(null);
    const family = {
      id: 'm_familia',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      householdId: FAMILY_HOUSEHOLD_ID,
      role: 'member',
      household: {
        id: FAMILY_HOUSEHOLD_ID,
        name: 'Família',
        ownerCompanyId: 'co_dono',
        personal: true,
        onboardingCompleted: true,
      },
    };
    const personal = {
      id: 'm_individual',
      createdAt: new Date('2026-02-01T00:00:00Z'),
      householdId: HOUSEHOLD_ID,
      role: 'owner',
      household: {
        id: HOUSEHOLD_ID,
        name: 'Meu grupo',
        ownerCompanyId: 'co_1',
        personal: true,
        onboardingCompleted: false,
      },
    };
    prisma.householdMember.findMany.mockResolvedValue([family, personal]);
    const svc = new HouseholdService(prisma as never);
    const account = await svc.getAccount('co_1');
    expect(account.households).toEqual([
      { id: HOUSEHOLD_ID, name: 'Meu grupo', role: 'owner', personal: true },
      {
        id: FAMILY_HOUSEHOLD_ID,
        name: 'Família',
        role: 'member',
        personal: false,
      },
    ]);
    expect(account.activeHousehold).toEqual({
      id: FAMILY_HOUSEHOLD_ID,
      name: 'Família',
      role: 'member',
      personal: false,
      onboardingCompleted: true,
    });
    expect(account.household).toEqual(account.activeHousehold);
  });

  it('creates the personal group once, only on GET /account without the header', async () => {
    const prisma = fakePrisma();
    prisma.personName.findUnique.mockResolvedValue(null);
    const family = {
      id: 'm_familia',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      householdId: FAMILY_HOUSEHOLD_ID,
      role: 'member',
      household: {
        id: FAMILY_HOUSEHOLD_ID,
        name: 'Família',
        ownerCompanyId: 'co_dono',
        personal: true,
        onboardingCompleted: true,
      },
    };
    prisma.householdMember.findMany.mockResolvedValue([family]);
    prisma.householdMember.findUnique.mockResolvedValue(family);
    prisma.household.create.mockResolvedValue({ id: HOUSEHOLD_ID });
    const svc = new HouseholdService(prisma as never);

    // Com header não cria, mesmo sendo a família da própria pessoa.
    await svc.getAccount('co_1', null, FAMILY_HOUSEHOLD_ID);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    // PATCH /account e o onboarding também não criam.
    await svc.updateDisplayName('co_1', 'Ana');
    await svc.completeOnboarding(
      { ...memberOf('member'), householdId: FAMILY_HOUSEHOLD_ID },
      null,
      {
        fullName: null,
        displayName: null,
        goals: [],
        importMode: null,
        cryptoFamiliarity: null,
        cryptoActions: [],
        showFreedom: true,
        showFamily: true,
        learnCrypto: false,
      },
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();

    await svc.getAccount('co_1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.household.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty name, a name past 32 characters, an email change, and a role', () => {
    expect(() => readDisplayNamePatch({ displayName: '  ' })).toThrow(
      HouseholdInvalidError,
    );
    expect(() => readDisplayNamePatch({ displayName: 'a'.repeat(33) })).toThrow(
      '32 caracteres',
    );
    expect(() =>
      readDisplayNamePatch({ displayName: 'Ana', email: 'ana@x.com' }),
    ).toThrow('e-mail');
    expect(() =>
      readDisplayNamePatch({ displayName: 'Ana', role: 'owner' }),
    ).toThrow('papel');
    expect(readDisplayNamePatch({ displayName: ' Ana ' })).toBe('Ana');
  });

  it('blocks the last admin from leaving the group', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.count.mockResolvedValue(0);
    const svc = new HouseholdService(prisma as never);
    await expect(svc.leave(memberOf('owner'))).rejects.toThrow('último admin');
    expect(prisma.householdMember.delete).not.toHaveBeenCalled();
  });

  it('putProfile marks onboarding complete', async () => {
    const prisma = fakePrisma();
    const svc = new HouseholdService(prisma as never);
    await svc.putProfile(memberOf('member'), {
      householdSize: 'two',
      monthlyIncomeCents: 500000,
      reserveCents: 100000,
      priorities: ['reserva'],
      goalMonths: 12,
      cryptoExperience: 'declined',
    });
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: HOUSEHOLD_ID },
      data: expect.objectContaining({
        onboardingCompleted: true,
        goalMonths: 12,
      }),
    });
  });

  it('skip only sets onboardingCompleted', async () => {
    const prisma = fakePrisma();
    const svc = new HouseholdService(prisma as never);
    await svc.skip(memberOf('owner'));
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: HOUSEHOLD_ID },
      data: { onboardingCompleted: true },
    });
  });

  it('rejects a profile goal that is not 6, 12, 24 or 60 months', async () => {
    const prisma = fakePrisma();
    const svc = new HouseholdService(prisma as never);
    await expect(
      svc.putProfile(memberOf('member'), {
        householdSize: 'two',
        monthlyIncomeCents: 500000,
        reserveCents: 100000,
        priorities: ['reserva'],
        goalMonths: 7 as never,
        cryptoExperience: 'declined',
      }),
    ).rejects.toThrow('goalMonths is invalid');
    expect(prisma.household.update).not.toHaveBeenCalled();
  });

  it('rejects a negative income and an unknown crypto experience', async () => {
    const prisma = fakePrisma();
    const svc = new HouseholdService(prisma as never);
    await expect(
      svc.patchProfile(memberOf('member'), { monthlyIncomeCents: -1 }),
    ).rejects.toThrow('monthlyIncomeCents is invalid');
    await expect(
      svc.patchProfile(memberOf('member'), {
        cryptoExperience: 'expert' as never,
      }),
    ).rejects.toThrow('cryptoExperience is invalid');
    expect(prisma.household.update).not.toHaveBeenCalled();
  });

  it('patch beginner does not change onboardingCompleted', async () => {
    const prisma = fakePrisma();
    const svc = new HouseholdService(prisma as never);
    await svc.patchProfile(memberOf('member'), {
      cryptoExperience: 'beginner',
    });
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: HOUSEHOLD_ID },
      data: { cryptoExperience: 'beginner' },
    });
  });

  it('lets only the owner invite, and blocks someone already in a group', async () => {
    const prisma = fakePrisma();
    const svc = new HouseholdService(prisma as never);
    await expect(
      svc.invite(memberOf('member', 'co_member'), 'bia@example.com'),
    ).rejects.toBeInstanceOf(HouseholdForbiddenError);

    prisma.personName.findFirst.mockResolvedValue({ companyId: 'co_bia' });
    prisma.householdMember.findFirst.mockResolvedValue({ id: 'm_bia' });
    await expect(
      svc.invite(memberOf('owner'), 'bia@example.com'),
    ).rejects.toBeInstanceOf(HouseholdConflictError);
    expect(prisma.householdInvite.create).not.toHaveBeenCalled();
  });

  it('accepts a pending invite when the Google email matches and the person is free', async () => {
    const prisma = fakePrisma();
    prisma.householdInvite.findUnique.mockResolvedValue({
      id: 'inv1',
      householdId: 'h1',
      email: 'bia@example.com',
      status: 'pending',
    });
    const svc = new HouseholdService(prisma as never);
    await svc.acceptInvite('co_bia', 'inv1', 'Bia@example.com');
    expect(prisma.householdMember.create).toHaveBeenCalledWith({
      data: { householdId: 'h1', companyId: 'co_bia', role: 'member' },
    });
    expect(prisma.householdInvite.update).toHaveBeenCalledWith({
      where: { id: 'inv1' },
      data: { status: 'accepted' },
    });
  });

  it('recusa o convite do e-mail antigo quando o Privy já trocou o e-mail', async () => {
    const prisma = fakePrisma();
    prisma.personName.findUnique.mockResolvedValue({
      email: 'antigo@example.com',
    });
    prisma.householdInvite.findUnique.mockResolvedValue({
      id: 'inv1',
      householdId: 'h1',
      email: 'antigo@example.com',
      status: 'pending',
    });
    const svc = new HouseholdService(prisma as never);
    await expect(
      svc.acceptInvite('co_bia', 'inv1', 'novo@example.com'),
    ).rejects.toBeInstanceOf(HouseholdConflictError);
    expect(prisma.householdMember.create).not.toHaveBeenCalled();
    expect(prisma.personName.findUnique).not.toHaveBeenCalled();
  });

  it('rejects accept when the person already belongs to a group', async () => {
    const prisma = fakePrisma();
    prisma.householdInvite.findUnique.mockResolvedValue({
      id: 'inv1',
      householdId: 'h1',
      email: 'bia@example.com',
      status: 'pending',
    });
    prisma.householdMember.findFirst.mockResolvedValue({ id: 'm_bia' });
    const svc = new HouseholdService(prisma as never);
    await expect(
      svc.acceptInvite('co_bia', 'inv1', 'bia@example.com'),
    ).rejects.toBeInstanceOf(HouseholdConflictError);
    expect(prisma.householdMember.findFirst).toHaveBeenCalledWith(
      groupOutsideEmptyPersonal('co_bia'),
    );
  });

  it('o convite só ignora o individual próprio sem outros membros', async () => {
    const prisma = fakePrisma();
    prisma.personName.findFirst.mockResolvedValue({ companyId: 'co_bia' });
    prisma.householdMember.findFirst.mockResolvedValue({ id: 'm_bia' });
    const svc = new HouseholdService(prisma as never);
    await expect(
      svc.invite(memberOf('owner'), 'bia@example.com'),
    ).rejects.toBeInstanceOf(HouseholdConflictError);
    expect(prisma.householdMember.findFirst).toHaveBeenCalledWith(
      groupOutsideEmptyPersonal('co_bia'),
    );
  });

  it('recusa o convite de quem já é membro do grupo, como o autoconvite', async () => {
    const prisma = fakePrisma();
    prisma.personName.findFirst.mockResolvedValue({ companyId: 'co_1' });
    prisma.householdMember.findUnique.mockResolvedValue({ id: 'm_1' });
    const svc = new HouseholdService(prisma as never);
    await expect(
      svc.invite(memberOf('owner'), 'eu@example.com'),
    ).rejects.toBeInstanceOf(HouseholdConflictError);
    expect(prisma.householdMember.findUnique).toHaveBeenCalledWith({
      where: {
        householdId_companyId: {
          householdId: HOUSEHOLD_ID,
          companyId: 'co_1',
        },
      },
      select: { id: true },
    });
    expect(prisma.householdInvite.create).not.toHaveBeenCalled();
  });

  it('recusa o aceite de quem já é membro do grupo do convite', async () => {
    const prisma = fakePrisma();
    prisma.householdInvite.findUnique.mockResolvedValue({
      id: 'inv1',
      householdId: 'h1',
      email: 'eu@example.com',
      status: 'pending',
    });
    prisma.householdMember.findUnique.mockResolvedValue({ id: 'm_1' });
    const svc = new HouseholdService(prisma as never);
    await expect(
      svc.acceptInvite('co_1', 'inv1', 'eu@example.com'),
    ).rejects.toBeInstanceOf(HouseholdConflictError);
    expect(prisma.householdMember.findUnique).toHaveBeenCalledWith({
      where: {
        householdId_companyId: { householdId: 'h1', companyId: 'co_1' },
      },
      select: { id: true },
    });
    expect(prisma.householdMember.create).not.toHaveBeenCalled();
    expect(prisma.householdInvite.update).not.toHaveBeenCalled();
  });

  it('saves the name shown on the platform', async () => {
    const prisma = fakePrisma();
    prisma.personName.findUnique.mockResolvedValue({
      displayName: 'Marina',
      fullName: null,
      email: 'marina@example.com',
    });
    const svc = new HouseholdService(prisma as never);
    const account = await svc.updateDisplayName(
      'co_1',
      ' Marina ',
      'marina@example.com',
    );
    expect(prisma.personName.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { displayName: 'Marina' },
      }),
    );
    expect(account.displayName).toBe('Marina');
    expect(account.email).toBe('marina@example.com');
  });

  it('blocks a member from renaming the group', async () => {
    const prisma = fakePrisma();
    const svc = new HouseholdService(prisma as never);
    await expect(
      svc.renameHousehold(memberOf('member'), 'Nova casa'),
    ).rejects.toBeInstanceOf(HouseholdForbiddenError);
  });

  it('removes a member by the composite key of the active group', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({
      householdId: HOUSEHOLD_ID,
      companyId: 'co_bia',
      role: 'member',
    });
    const svc = new HouseholdService(prisma as never);
    await svc.removeMember(memberOf('owner'), 'co_bia');
    const compositeKey = {
      householdId_companyId: { householdId: HOUSEHOLD_ID, companyId: 'co_bia' },
    };
    expect(prisma.householdMember.findUnique).toHaveBeenCalledWith({
      where: compositeKey,
    });
    expect(prisma.householdMember.delete).toHaveBeenCalledWith({
      where: compositeKey,
    });
  });

  it('completes onboarding without changing income, reserve, or goal months', async () => {
    const prisma = fakePrisma();
    ownsPersonalHousehold(prisma);
    prisma.personName.findUnique.mockResolvedValue({
      displayName: 'Mari',
      fullName: 'Marina Souza',
      email: 'mari@example.com',
    });
    const svc = new HouseholdService(prisma as never);
    const account = await svc.completeOnboarding(
      memberOf('owner'),
      'mari@example.com',
      {
        fullName: 'Marina Souza',
        displayName: 'Mari',
        goals: ['gastos', 'aprender'],
        importMode: 'manual',
        cryptoFamiliarity: 'ouvi',
        cryptoActions: [],
        showFreedom: false,
        showFamily: false,
        learnCrypto: true,
      },
    );
    expect(account.activeHousehold?.id).toBe(HOUSEHOLD_ID);
    expect(prisma.personName.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          displayName: 'Mari',
          fullName: 'Marina Souza',
          email: 'mari@example.com',
        },
      }),
    );
    const data = prisma.household.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      goals: ['gastos', 'aprender'],
      importMode: 'manual',
      cryptoFamiliarity: 'ouvi',
      cryptoActions: [],
      showFreedom: false,
      showFamily: false,
      cryptoExperience: 'beginner',
      onboardingCompleted: true,
    });
    expect(data.monthlyIncomeCents).toBeUndefined();
    expect(data.reserveCents).toBeUndefined();
    expect(data.goalMonths).toBeUndefined();
  });

  it('drops crypto actions when the person has not bought crypto', async () => {
    const prisma = fakePrisma();
    ownsPersonalHousehold(prisma);
    const svc = new HouseholdService(prisma as never);
    await svc.completeOnboarding(memberOf('owner'), null, {
      fullName: null,
      displayName: null,
      goals: [],
      importMode: null,
      cryptoFamiliarity: 'nunca',
      cryptoActions: ['stable', 'autocustodia'],
      showFreedom: true,
      showFamily: false,
      learnCrypto: false,
    });
    expect(prisma.personName.upsert).not.toHaveBeenCalled();
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: HOUSEHOLD_ID },
      data: expect.objectContaining({
        cryptoActions: [],
        cryptoExperience: 'declined',
        onboardingCompleted: true,
      }),
    });
  });

  it('rejects an unknown goal and writes nothing', async () => {
    const prisma = fakePrisma();
    const svc = new HouseholdService(prisma as never);
    await expect(
      svc.completeOnboarding(memberOf('owner'), null, {
        fullName: 'Ana',
        displayName: 'Ana',
        goals: ['nope' as never],
        importMode: 'ofx',
        cryptoFamiliarity: 'ouvi',
        cryptoActions: [],
        showFreedom: true,
        showFamily: false,
        learnCrypto: true,
      }),
    ).rejects.toThrow('goals is invalid');
    expect(prisma.household.update).not.toHaveBeenCalled();
    expect(prisma.personName.upsert).not.toHaveBeenCalled();
  });

  it('uses the first name when the nickname is empty', async () => {
    const prisma = fakePrisma();
    ownsPersonalHousehold(prisma);
    prisma.personName.findUnique.mockResolvedValue({
      displayName: 'Marina',
      fullName: 'Marina Souza',
    });
    const svc = new HouseholdService(prisma as never);
    await svc.completeOnboarding(memberOf('owner'), null, {
      fullName: ' Marina Souza ',
      displayName: ' ',
      goals: ['reserva'],
      importMode: 'ofx',
      cryptoFamiliarity: 'comprei',
      cryptoActions: ['rendimento'],
      showFreedom: true,
      showFamily: false,
      learnCrypto: true,
    });
    expect(prisma.personName.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { displayName: 'Marina', fullName: 'Marina Souza' },
      }),
    );
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: HOUSEHOLD_ID },
      data: expect.objectContaining({
        cryptoExperience: 'fund',
        cryptoActions: ['rendimento'],
      }),
    });
  });
});
