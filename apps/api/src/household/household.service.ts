import { Injectable } from '@nestjs/common';
import type {
  AccountView,
  GoalMonths,
  HouseholdPersonView,
  HouseholdProfile,
  HouseholdRole,
  UpsertHouseholdProfile,
} from '@yield2pay/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  HouseholdConflictError,
  HouseholdForbiddenError,
  HouseholdInvalidError,
  HouseholdNotFoundError,
} from './household.errors';

export function initialsOf(
  fullName: string | null | undefined,
  displayName: string | null | undefined,
): string {
  const source = fullName?.trim() || displayName?.trim() || '';
  if (!source) return '?';
  const words = source.split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word[0].toUpperCase());
  return letters.join('') || '?';
}

@Injectable()
export class HouseholdService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, name: string) {
    const existing = await this.prisma.householdMember.findUnique({
      where: { companyId },
    });
    if (existing) {
      throw new HouseholdConflictError();
    }

    const household = await this.prisma.household.create({
      data: { name, ownerCompanyId: companyId },
    });

    await this.prisma.householdMember.create({
      data: {
        householdId: household.id,
        companyId,
        role: 'owner',
      },
    });

    return { id: household.id, name: household.name, role: 'owner' as const };
  }

  async requireMembership(companyId: string) {
    const member = await this.prisma.householdMember.findUnique({
      where: { companyId },
    });
    if (!member) {
      throw new HouseholdNotFoundError();
    }
    return { householdId: member.householdId, role: member.role };
  }

  async getAccount(
    companyId: string,
    email?: string | null,
  ): Promise<AccountView> {
    if (email?.trim()) {
      await this.prisma.personName.upsert({
        where: { companyId },
        create: { companyId, email: email.trim().toLowerCase() },
        update: { email: email.trim().toLowerCase() },
      });
    }
    const person = await this.prisma.personName.findUnique({
      where: { companyId },
    });
    const displayName = person?.displayName ?? null;
    const fullName = person?.fullName ?? null;
    const member = await this.prisma.householdMember.findUnique({
      where: { companyId },
    });
    if (!member) {
      return {
        displayName,
        fullName,
        email: person?.email ?? null,
        initials: initialsOf(fullName, displayName),
        accountType: 'family',
        household: null,
      };
    }
    const household = await this.prisma.household.findUnique({
      where: { id: member.householdId },
    });
    return {
      displayName,
      fullName,
      email: person?.email ?? null,
      initials: initialsOf(fullName, displayName),
      accountType: 'family',
      household: {
        id: member.householdId,
        name: household?.name ?? '',
        role: member.role as HouseholdRole,
        onboardingCompleted: household?.onboardingCompleted ?? false,
      },
    };
  }

  async getProfile(companyId: string): Promise<HouseholdProfile> {
    const { householdId } = await this.requireMembership(companyId);
    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
    });
    if (!household) {
      throw new HouseholdNotFoundError();
    }
    return {
      householdSize: household.householdSize as HouseholdProfile['householdSize'],
      monthlyIncomeCents: household.monthlyIncomeCents,
      reserveCents: household.reserveCents,
      priorities: household.priorities,
      goalMonths: household.goalMonths as GoalMonths | null,
      cryptoExperience:
        household.cryptoExperience as HouseholdProfile['cryptoExperience'],
      onboardingCompleted: household.onboardingCompleted,
    };
  }

  async putProfile(companyId: string, body: UpsertHouseholdProfile) {
    const data = readProfile(body, true);
    const { householdId } = await this.requireMembership(companyId);
    await this.prisma.household.update({
      where: { id: householdId },
      data: { ...data, onboardingCompleted: true },
    });
  }

  async patchProfile(
    companyId: string,
    body: Partial<UpsertHouseholdProfile>,
  ) {
    const data = readProfile(body, false);
    if (Object.keys(data).length === 0) {
      return;
    }
    const { householdId } = await this.requireMembership(companyId);
    await this.prisma.household.update({
      where: { id: householdId },
      data,
    });
  }

  async skip(companyId: string) {
    const { householdId } = await this.requireMembership(companyId);
    await this.prisma.household.update({
      where: { id: householdId },
      data: { onboardingCompleted: true },
    });
  }

  async getCurrent(companyId: string) {
    const { householdId, role } = await this.requireMembership(companyId);
    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
    });
    if (!household) {
      throw new HouseholdNotFoundError();
    }
    const pendingInvites =
      role === 'owner'
        ? await this.prisma.householdInvite.findMany({
            where: { householdId, status: 'pending' },
            select: { id: true, email: true },
          })
        : [];
    return {
      id: household.id,
      name: household.name,
      role,
      onboardingCompleted: household.onboardingCompleted,
      pendingInvites,
    };
  }

  async invite(companyId: string, email: string) {
    const { householdId, role } = await this.requireMembership(companyId);
    if (role !== 'owner') {
      throw new HouseholdForbiddenError();
    }
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      throw new HouseholdConflictError();
    }
    const person = await this.prisma.personName.findFirst({
      where: { email: normalized },
    });
    if (person) {
      const existingMember = await this.prisma.householdMember.findUnique({
        where: { companyId: person.companyId },
      });
      if (existingMember) {
        throw new HouseholdConflictError();
      }
    }
    const pending = await this.prisma.householdInvite.findFirst({
      where: { householdId, email: normalized, status: 'pending' },
    });
    if (pending) {
      throw new HouseholdConflictError();
    }
    return this.prisma.householdInvite.create({
      data: { householdId, email: normalized, status: 'pending' },
    });
  }

  async acceptInvite(
    companyId: string,
    inviteId: string,
    email: string | null,
  ) {
    if (!email) {
      throw new HouseholdConflictError();
    }
    const invite = await this.prisma.householdInvite.findUnique({
      where: { id: inviteId },
    });
    if (
      !invite ||
      invite.status !== 'pending' ||
      invite.email.toLowerCase() !== email.trim().toLowerCase()
    ) {
      throw new HouseholdConflictError();
    }
    const existing = await this.prisma.householdMember.findUnique({
      where: { companyId },
    });
    if (existing) {
      throw new HouseholdConflictError();
    }
    await this.prisma.householdMember.create({
      data: {
        householdId: invite.householdId,
        companyId,
        role: 'member',
      },
    });
    await this.prisma.householdInvite.update({
      where: { id: inviteId },
      data: { status: 'accepted' },
    });
  }

  async revokeInvite(companyId: string, inviteId: string) {
    const { householdId, role } = await this.requireMembership(companyId);
    if (role !== 'owner') {
      throw new HouseholdForbiddenError();
    }
    const invite = await this.prisma.householdInvite.findUnique({
      where: { id: inviteId },
    });
    if (
      !invite ||
      invite.status !== 'pending' ||
      invite.householdId !== householdId
    ) {
      throw new HouseholdConflictError();
    }
    await this.prisma.householdInvite.update({
      where: { id: inviteId },
      data: { status: 'revoked' },
    });
  }

  async updateDisplayName(companyId: string, displayName: string, email?: string | null): Promise<AccountView> {
    const name = displayName.trim().slice(0, 32);
    if (!name) {
      throw new HouseholdConflictError();
    }
    await this.prisma.personName.upsert({
      where: { companyId },
      create: { companyId, displayName: name, email: email?.trim().toLowerCase() || null },
      update: { displayName: name },
    });
    return this.getAccount(companyId, email);
  }

  async renameHousehold(companyId: string, name: string) {
    const { householdId, role } = await this.requireMembership(companyId);
    if (role !== 'owner') {
      throw new HouseholdForbiddenError();
    }
    const next = name.trim().slice(0, 40);
    if (!next) {
      throw new HouseholdConflictError();
    }
    await this.prisma.household.update({
      where: { id: householdId },
      data: { name: next },
    });
  }

  async listPeople(companyId: string): Promise<HouseholdPersonView[]> {
    const { householdId } = await this.requireMembership(companyId);
    const members = await this.prisma.householdMember.findMany({ where: { householdId } });
    const names = await this.prisma.personName.findMany({
      where: { companyId: { in: members.map((member) => member.companyId) } },
    });
    const byCompany = new Map(names.map((person) => [person.companyId, person]));
    const people: HouseholdPersonView[] = members.map((member) => {
      const person = byCompany.get(member.companyId);
      return {
        id: member.companyId,
        email: person?.email ?? '',
        displayName: person?.displayName?.trim() || person?.fullName?.trim() || 'Membro',
        role: member.role === 'owner' ? 'owner' : 'member',
        you: member.companyId === companyId,
      };
    });
    const invites = await this.prisma.householdInvite.findMany({
      where: { householdId, status: 'pending' },
    });
    for (const invite of invites) {
      people.push({
        id: invite.id,
        email: invite.email,
        displayName: '',
        role: 'invited',
        you: false,
      });
    }
    return people;
  }

  async removeMember(actorId: string, memberCompanyId: string) {
    const { householdId, role } = await this.requireMembership(actorId);
    if (role !== 'owner' || memberCompanyId === actorId) {
      throw new HouseholdForbiddenError();
    }
    const target = await this.prisma.householdMember.findUnique({
      where: { companyId: memberCompanyId },
    });
    if (!target || target.householdId !== householdId || target.role === 'owner') {
      throw new HouseholdConflictError();
    }
    await this.prisma.householdMember.delete({ where: { companyId: memberCompanyId } });
  }

  async leave(companyId: string) {
    const { householdId, role } = await this.requireMembership(companyId);
    if (role === 'owner') {
      const others = await this.prisma.householdMember.count({
        where: { householdId, companyId: { not: companyId } },
      });
      if (others > 0) {
        throw new HouseholdForbiddenError();
      }
    }
    await this.prisma.householdMember.delete({ where: { companyId } });
  }

  async clearMyData(companyId: string, mode: 'expenses' | 'all') {
    const { householdId } = await this.requireMembership(companyId);
    await this.prisma.expense.deleteMany({
      where: { householdId, addedByCompanyId: companyId },
    });
    if (mode === 'all') {
      await this.prisma.lessonProgress.deleteMany({ where: { companyId } });
    }
  }
}

const HOUSEHOLD_SIZES = new Set(['solo', 'two', 'three_to_four', 'five_or_more']);
const GOAL_MONTHS = new Set<GoalMonths>([6, 12, 24, 60]);
const CRYPTO_EXPERIENCE = new Set(['beginner', 'fund', 'declined']);

function readProfile(
  body: Partial<UpsertHouseholdProfile>,
  requireAll: boolean,
): Partial<UpsertHouseholdProfile> {
  const data: Partial<UpsertHouseholdProfile> = {};
  if (requireAll || body.householdSize !== undefined) {
    if (!HOUSEHOLD_SIZES.has(body.householdSize as string)) {
      throw new HouseholdInvalidError('householdSize is invalid');
    }
    data.householdSize = body.householdSize;
  }
  if (requireAll || body.monthlyIncomeCents !== undefined) {
    data.monthlyIncomeCents = readCents(body.monthlyIncomeCents, 'monthlyIncomeCents');
  }
  if (requireAll || body.reserveCents !== undefined) {
    data.reserveCents = readCents(body.reserveCents, 'reserveCents');
  }
  if (requireAll || body.priorities !== undefined) {
    if (!Array.isArray(body.priorities) || body.priorities.some((item) => typeof item !== 'string')) {
      throw new HouseholdInvalidError('priorities is invalid');
    }
    data.priorities = body.priorities;
  }
  if (requireAll || body.goalMonths !== undefined) {
    if (!GOAL_MONTHS.has(body.goalMonths as GoalMonths)) {
      throw new HouseholdInvalidError('goalMonths is invalid');
    }
    data.goalMonths = body.goalMonths;
  }
  if (requireAll || body.cryptoExperience !== undefined) {
    if (!CRYPTO_EXPERIENCE.has(body.cryptoExperience as string)) {
      throw new HouseholdInvalidError('cryptoExperience is invalid');
    }
    data.cryptoExperience = body.cryptoExperience;
  }
  return data;
}

function readCents(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new HouseholdInvalidError(`${field} is invalid`);
  }
  return value;
}
