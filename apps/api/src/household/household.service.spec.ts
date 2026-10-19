import { HouseholdService } from './household.service';
import {
  HouseholdConflictError,
  HouseholdForbiddenError,
} from './household.errors';

function fakePrisma() {
  return {
    householdMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    household: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    personName: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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

  it('returns family account initials from the full name', async () => {
    const prisma = fakePrisma();
    prisma.personName.findUnique.mockResolvedValue({
      displayName: 'Ana', fullName: 'Ana Lima',
    });
    prisma.householdMember.findUnique.mockResolvedValue(null);
    const svc = new HouseholdService(prisma as never);
    const account = await svc.getAccount('co_1');
    expect(account).toMatchObject({
      initials: 'AL',
      accountType: 'family',
      household: null,
    });
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
});
