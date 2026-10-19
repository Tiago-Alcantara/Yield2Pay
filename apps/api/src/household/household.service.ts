import { Injectable } from '@nestjs/common';
import type {
  AccountView,
  GoalMonths,
  HouseholdProfile,
  HouseholdRole,
  UpsertHouseholdProfile,
} from '@yield2pay/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  HouseholdConflictError,
  HouseholdForbiddenError,
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
    const { householdId } = await this.requireMembership(companyId);
    await this.prisma.household.update({
      where: { id: householdId },
      data: { ...body, onboardingCompleted: true },
    });
  }

  async patchProfile(
    companyId: string,
    body: Partial<UpsertHouseholdProfile>,
  ) {
    const { householdId } = await this.requireMembership(companyId);
    await this.prisma.household.update({
      where: { id: householdId },
      data: { ...body },
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
}
