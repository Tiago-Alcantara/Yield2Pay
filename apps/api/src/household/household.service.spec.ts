/**
 * Módulo: household.service
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: Conta, perfil, onboarding e saída do grupo seguem as regras da casa.
 * Sequência: creates a household and an owner membership; rejects a second household for the same person; returns initials from the name shown, keeping an emoji whole; rejects an empty name, a name past 32 characters, an email change, and a role; blocks the last admin from leaving the group; putProfile marks onboarding complete; skip only sets onboardingCompleted; rejects a profile goal that is not 6, 12, 24 or 60 months; rejects a negative income and an unknown crypto experience; patch beginner does not change onboardingCompleted; lets only the owner invite, and blocks someone already in a group; accepts a pending invite when the Google email matches and the person is free; rejects accept when the person already belongs to a group; saves the name shown on the platform; blocks a member from renaming the group; completes onboarding without changing income, reserve, or goal months; drops crypto actions when the person has not bought crypto; rejects an unknown goal and writes nothing; uses the first name when the nickname is empty.
 */
import { HouseholdService, initialsOf, readDisplayNamePatch } from './household.service';
import {
  HouseholdConflictError,
  HouseholdForbiddenError,
  HouseholdInvalidError,
} from './household.errors';

function fakePrisma() {
  return {
    householdMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    household: {
      create: vi.fn(),
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
  };
}

describe('HouseholdService', () => {
  it('creates a household and an owner membership', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue(null);
    prisma.household.create.mockResolvedValue({ id: 'h1', name: 'Casa 1' });
    const svc = new HouseholdService(prisma as never);
    const created = await svc.create('co_1', 'Casa 1');
    expect(created).toEqual({ id: 'h1', name: 'Casa 1', role: 'owner' });
    expect(prisma.householdMember.create).toHaveBeenCalledWith({
      data: { householdId: 'h1', companyId: 'co_1', role: 'owner' },
    });
  });

  it('rejects a second household for the same person', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({ companyId: 'co_1' });
    const svc = new HouseholdService(prisma as never);
    await expect(svc.create('co_1', 'Outra')).rejects.toBeInstanceOf(
      HouseholdConflictError,
    );
  });

  it('returns initials from the name shown, keeping an emoji whole', async () => {
    const prisma = fakePrisma();
    prisma.personName.findUnique.mockResolvedValue({
      displayName: 'Zé 😀', fullName: 'Tiago Alcântara',
    });
    prisma.householdMember.findUnique.mockResolvedValue(null);
    const svc = new HouseholdService(prisma as never);
    const account = await svc.getAccount('co_1');
    expect(account.initials).toBe('Z😀');
    expect(initialsOf('Ana Lima', null)).toBe('AL');
    expect(initialsOf(null, '')).toBe('?');
  });

  it('rejects an empty name, a name past 32 characters, an email change, and a role', () => {
    expect(() => readDisplayNamePatch({ displayName: '  ' })).toThrow(HouseholdInvalidError);
    expect(() => readDisplayNamePatch({ displayName: 'a'.repeat(33) })).toThrow('32 caracteres');
    expect(() => readDisplayNamePatch({ displayName: 'Ana', email: 'ana@x.com' })).toThrow('e-mail');
    expect(() => readDisplayNamePatch({ displayName: 'Ana', role: 'owner' })).toThrow('papel');
    expect(readDisplayNamePatch({ displayName: ' Ana ' })).toBe('Ana');
  });

  it('blocks the last admin from leaving the group', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'owner' });
    prisma.householdMember.count.mockResolvedValue(0);
    const svc = new HouseholdService(prisma as never);
    await expect(svc.leave('co_1')).rejects.toThrow('último admin');
    expect(prisma.householdMember.delete).not.toHaveBeenCalled();
  });

  it('putProfile marks onboarding complete', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({
      householdId: 'h1', role: 'member',
    });
    const svc = new HouseholdService(prisma as never);
    await svc.putProfile('co_1', {
      householdSize: 'two',
      monthlyIncomeCents: 500000,
      reserveCents: 100000,
      priorities: ['reserva'],
      goalMonths: 12,
      cryptoExperience: 'declined',
    });
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: expect.objectContaining({ onboardingCompleted: true, goalMonths: 12 }),
    });
  });

  it('skip only sets onboardingCompleted', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'owner' });
    const svc = new HouseholdService(prisma as never);
    await svc.skip('co_1');
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { onboardingCompleted: true },
    });
  });

  it('rejects a profile goal that is not 6, 12, 24 or 60 months', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'member' });
    const svc = new HouseholdService(prisma as never);
    await expect(svc.putProfile('co_1', {
      householdSize: 'two',
      monthlyIncomeCents: 500000,
      reserveCents: 100000,
      priorities: ['reserva'],
      goalMonths: 7 as never,
      cryptoExperience: 'declined',
    })).rejects.toThrow('goalMonths is invalid');
    expect(prisma.household.update).not.toHaveBeenCalled();
  });

  it('rejects a negative income and an unknown crypto experience', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'member' });
    const svc = new HouseholdService(prisma as never);
    await expect(svc.patchProfile('co_1', { monthlyIncomeCents: -1 })).rejects.toThrow(
      'monthlyIncomeCents is invalid',
    );
    await expect(svc.patchProfile('co_1', { cryptoExperience: 'expert' as never })).rejects.toThrow(
      'cryptoExperience is invalid',
    );
    expect(prisma.household.update).not.toHaveBeenCalled();
  });

  it('patch beginner does not change onboardingCompleted', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'member' });
    const svc = new HouseholdService(prisma as never);
    await svc.patchProfile('co_1', { cryptoExperience: 'beginner' });
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { cryptoExperience: 'beginner' },
    });
  });

  it('lets only the owner invite, and blocks someone already in a group', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'member' });
    const svc = new HouseholdService(prisma as never);
    await expect(svc.invite('co_member', 'bia@example.com')).rejects.toBeInstanceOf(HouseholdForbiddenError);
  });

  it('accepts a pending invite when the Google email matches and the person is free', async () => {
    const prisma = fakePrisma();
    prisma.householdInvite.findUnique.mockResolvedValue({
      id: 'inv1', householdId: 'h1', email: 'bia@example.com', status: 'pending',
    });
    prisma.householdMember.findUnique.mockResolvedValue(null);
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

  it('rejects accept when the person already belongs to a group', async () => {
    const prisma = fakePrisma();
    prisma.householdInvite.findUnique.mockResolvedValue({
      id: 'inv1', householdId: 'h1', email: 'bia@example.com', status: 'pending',
    });
    prisma.householdMember.findUnique.mockResolvedValue({ companyId: 'co_bia' });
    const svc = new HouseholdService(prisma as never);
    await expect(svc.acceptInvite('co_bia', 'inv1', 'bia@example.com')).rejects.toBeInstanceOf(HouseholdConflictError);
  });

  it('saves the name shown on the platform', async () => {
    const prisma = fakePrisma();
    prisma.personName.findUnique.mockResolvedValue({
      displayName: 'Marina', fullName: null, email: 'marina@example.com',
    });
    prisma.householdMember.findUnique.mockResolvedValue(null);
    const svc = new HouseholdService(prisma as never);
    const account = await svc.updateDisplayName('co_1', ' Marina ', 'marina@example.com');
    expect(prisma.personName.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { displayName: 'Marina' },
    }));
    expect(account.displayName).toBe('Marina');
    expect(account.email).toBe('marina@example.com');
  });

  it('blocks a member from renaming the group', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'member' });
    const svc = new HouseholdService(prisma as never);
    await expect(svc.renameHousehold('co_1', 'Nova casa')).rejects.toBeInstanceOf(HouseholdForbiddenError);
  });

  it('completes onboarding without changing income, reserve, or goal months', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'member' });
    prisma.personName.findUnique.mockResolvedValue({
      displayName: 'Mari', fullName: 'Marina Souza', email: 'mari@example.com',
    });
    prisma.household.findUnique.mockResolvedValue({
      id: 'h1', name: 'Casa', onboardingCompleted: true,
    });
    const svc = new HouseholdService(prisma as never);
    await svc.completeOnboarding('co_1', 'mari@example.com', {
      fullName: 'Marina Souza',
      displayName: 'Mari',
      goals: ['gastos', 'aprender'],
      importMode: 'manual',
      cryptoFamiliarity: 'ouvi',
      cryptoActions: [],
      showFreedom: false,
      showFamily: false,
      learnCrypto: true,
    });
    expect(prisma.personName.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { displayName: 'Mari', fullName: 'Marina Souza' },
    }));
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
    prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'owner' });
    prisma.household.findUnique.mockResolvedValue({ id: 'h1', name: 'Casa', onboardingCompleted: true });
    const svc = new HouseholdService(prisma as never);
    await svc.completeOnboarding('co_1', null, {
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
      where: { id: 'h1' },
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
    await expect(svc.completeOnboarding('co_1', null, {
      fullName: 'Ana',
      displayName: 'Ana',
      goals: ['nope' as never],
      importMode: 'ofx',
      cryptoFamiliarity: 'ouvi',
      cryptoActions: [],
      showFreedom: true,
      showFamily: false,
      learnCrypto: true,
    })).rejects.toThrow('goals is invalid');
    expect(prisma.household.update).not.toHaveBeenCalled();
    expect(prisma.personName.upsert).not.toHaveBeenCalled();
  });

  it('uses the first name when the nickname is empty', async () => {
    const prisma = fakePrisma();
    prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'owner' });
    prisma.personName.findUnique.mockResolvedValue({ displayName: 'Marina', fullName: 'Marina Souza' });
    prisma.household.findUnique.mockResolvedValue({ id: 'h1', name: 'Casa', onboardingCompleted: true });
    const svc = new HouseholdService(prisma as never);
    await svc.completeOnboarding('co_1', null, {
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
    expect(prisma.personName.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { displayName: 'Marina', fullName: 'Marina Souza' },
    }));
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: expect.objectContaining({ cryptoExperience: 'fund', cryptoActions: ['rendimento'] }),
    });
  });
});
