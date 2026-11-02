import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  accountInitials,
  cryptoExperienceFor,
  isMature,
  onboardingLevel,
  type AccountHouseholdView,
  type AccountView,
  type ActiveHouseholdView,
  type CompleteOnboarding,
  type CryptoAction,
  type CryptoFamiliarity,
  type GoalMonths,
  type HouseholdPersonView,
  type HouseholdProfile,
  type HouseholdRole,
  type ImportMode,
  type OnboardingGoal,
  type PatchHouseholdProfile,
  type UpsertHouseholdProfile,
} from '@yield2pay/shared';
import type { ActiveMembership } from '../auth/authenticated-request';
import { PrismaService } from '../prisma/prisma.service';
import {
  ensurePersonalHousehold,
  lockPersonalHousehold,
  resolveActiveHousehold,
} from './active-household';
import {
  HouseholdConflictError,
  HouseholdForbiddenError,
  HouseholdInvalidError,
  HouseholdNotFoundError,
} from './household.errors';

/** Mesma regra do modal: apelido, senão nome completo, sem cortar emoji. */
export function initialsOf(
  fullName: string | null | undefined,
  displayName: string | null | undefined,
): string {
  return accountInitials(fullName, displayName);
}

const DISPLAY_NAME_MAX = 32;

export function readDisplayNamePatch(body: unknown): string {
  if (!body || typeof body !== 'object') {
    throw new HouseholdInvalidError('Informe um nome');
  }
  const record = body as Record<string, unknown>;
  if ('email' in record) {
    throw new HouseholdInvalidError('O e-mail de acesso não pode ser alterado');
  }
  if ('role' in record) {
    throw new HouseholdInvalidError('O papel no grupo não pode ser alterado');
  }
  if (
    typeof record.displayName !== 'string' ||
    record.displayName.trim() === ''
  ) {
    throw new HouseholdInvalidError('Informe um nome');
  }
  const name = record.displayName.trim();
  if (name.length > DISPLAY_NAME_MAX) {
    throw new HouseholdInvalidError('O nome pode ter no máximo 32 caracteres');
  }
  return name;
}

@Injectable()
export class HouseholdService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria o grupo individual da pessoa. Só recusa quem já tem um: o membro
   * antigo que ainda não ganhou o individual pode criar o seu por aqui.
   */
  async create(companyId: string, name: string) {
    try {
      const household = await this.prisma.$transaction(async (tx) => {
        await lockPersonalHousehold(tx, companyId);
        const personalHousehold = await tx.household.findFirst({
          where: { ownerCompanyId: companyId, personal: true },
          select: { id: true },
        });
        if (personalHousehold) {
          throw new HouseholdConflictError();
        }
        const created = await tx.household.create({
          data: { name, ownerCompanyId: companyId, personal: true },
        });
        await tx.householdMember.create({
          data: { householdId: created.id, companyId, role: 'owner' },
        });
        return created;
      });
      return {
        id: household.id,
        name: household.name,
        role: 'owner' as const,
        personal: true,
      };
    } catch (error) {
      // O índice parcial recusou um segundo individual criado fora do lock.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new HouseholdConflictError();
      }
      throw error;
    }
  }

  /**
   * GET /account. É o único caminho que cria o grupo individual, e só sem o
   * header: um pedido com header nunca muda os grupos da pessoa.
   */
  async getAccount(
    companyId: string,
    email?: string | null,
    requestedHouseholdId?: string,
  ): Promise<AccountView> {
    if (requestedHouseholdId === undefined) {
      await ensurePersonalHousehold(this.prisma, companyId);
    }
    return this.accountView(companyId, email, requestedHouseholdId);
  }

  /**
   * Conta da pessoa: todos os grupos (households) e o grupo ativo.
   * requestedHouseholdId é o header X-Household-Id; sem ele vale o padrão
   * (chooseDefaultMembership). activeHousehold só é nulo para quem ainda não
   * tem grupo nenhum.
   */
  private async accountView(
    companyId: string,
    email?: string | null,
    requestedHouseholdId?: string,
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

    const memberships = await this.prisma.householdMember.findMany({
      where: { companyId },
      orderBy: { household: { name: 'asc' } },
      select: {
        role: true,
        household: {
          select: {
            id: true,
            name: true,
            ownerCompanyId: true,
            personal: true,
            onboardingCompleted: true,
          },
        },
      },
    });
    const households: AccountHouseholdView[] = memberships.map(
      (membership) => ({
        id: membership.household.id,
        name: membership.household.name,
        role: membership.role as HouseholdRole,
        personal:
          membership.household.personal &&
          membership.household.ownerCompanyId === companyId,
      }),
    );
    // O grupo individual vem primeiro; os outros seguem pelo nome.
    households.sort(
      (left, right) => Number(right.personal) - Number(left.personal),
    );

    let activeHousehold: ActiveHouseholdView | null = null;
    if (memberships.length > 0 || requestedHouseholdId !== undefined) {
      const active = await resolveActiveHousehold(
        this.prisma,
        companyId,
        requestedHouseholdId,
      );
      const activeMembership = memberships.find(
        (membership) => membership.household.id === active.householdId,
      );
      activeHousehold = {
        id: active.householdId,
        name: activeMembership?.household.name ?? '',
        role: active.role,
        personal: active.personal,
        onboardingCompleted:
          activeMembership?.household.onboardingCompleted ?? false,
      };
    }

    return {
      displayName,
      fullName,
      email: person?.email ?? null,
      initials: initialsOf(fullName, displayName),
      accountType: 'family',
      households,
      activeHousehold,
      household: activeHousehold,
    };
  }

  async getProfile(membership: ActiveMembership): Promise<HouseholdProfile> {
    const { householdId } = membership;
    const household = await this.prisma.household.findUnique({
      where: { id: householdId },
    });
    if (!household) {
      throw new HouseholdNotFoundError();
    }
    return {
      householdSize:
        household.householdSize as HouseholdProfile['householdSize'],
      monthlyIncomeCents: household.monthlyIncomeCents,
      reserveCents: household.reserveCents,
      priorities: household.priorities,
      goalMonths: household.goalMonths as GoalMonths | null,
      cryptoExperience:
        household.cryptoExperience as HouseholdProfile['cryptoExperience'],
      onboardingCompleted: household.onboardingCompleted,
      goals: household.goals as OnboardingGoal[],
      importMode: household.importMode as ImportMode | null,
      cryptoFamiliarity:
        household.cryptoFamiliarity as CryptoFamiliarity | null,
      cryptoActions: household.cryptoActions as CryptoAction[],
      showFreedom: household.showFreedom,
      showFamily: household.showFamily,
    };
  }

  async putProfile(membership: ActiveMembership, body: UpsertHouseholdProfile) {
    const data = readProfile(body, true);
    await this.prisma.household.update({
      where: { id: membership.householdId },
      data: { ...data, onboardingCompleted: true },
    });
  }

  async completeOnboarding(
    membership: ActiveMembership,
    email: string | null | undefined,
    body: CompleteOnboarding,
  ): Promise<AccountView> {
    const parsed = readComplete(body);
    const { householdId, companyId } = membership;
    const displayName = parsed.displayName || firstWord(parsed.fullName);
    if (displayName) {
      await this.prisma.personName.upsert({
        where: { companyId },
        create: {
          companyId,
          displayName,
          fullName: parsed.fullName,
          email: email?.trim().toLowerCase() || null,
        },
        update: {
          displayName,
          ...(parsed.fullName ? { fullName: parsed.fullName } : {}),
          ...(email?.trim() ? { email: email.trim().toLowerCase() } : {}),
        },
      });
    }
    const actions = isMature(parsed.cryptoFamiliarity)
      ? parsed.cryptoActions
      : [];
    const level = onboardingLevel(
      parsed.goals,
      parsed.cryptoFamiliarity,
      actions,
    );
    await this.prisma.household.update({
      where: { id: householdId },
      data: {
        goals: parsed.goals,
        importMode: parsed.importMode,
        cryptoFamiliarity: parsed.cryptoFamiliarity,
        cryptoActions: actions,
        showFreedom: parsed.showFreedom,
        showFamily: parsed.showFamily,
        cryptoExperience: cryptoExperienceFor(level, parsed.learnCrypto),
        onboardingCompleted: true,
      },
    });
    return this.accountView(companyId, email, householdId);
  }

  async patchProfile(
    membership: ActiveMembership,
    body: PatchHouseholdProfile,
  ) {
    const data = { ...readProfile(body, false), ...readFlags(body) };
    if (Object.keys(data).length === 0) {
      return;
    }
    await this.prisma.household.update({
      where: { id: membership.householdId },
      data,
    });
  }

  async skip(membership: ActiveMembership) {
    await this.prisma.household.update({
      where: { id: membership.householdId },
      data: { onboardingCompleted: true },
    });
  }

  async getCurrent(membership: ActiveMembership) {
    const { householdId, role, personal } = membership;
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
      personal,
      onboardingCompleted: household.onboardingCompleted,
      pendingInvites,
    };
  }

  async invite(membership: ActiveMembership, email: string) {
    const { householdId, role } = membership;
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
    if (
      person &&
      ((await this.isMemberOf(householdId, person.companyId)) ||
        (await this.isInAnotherGroup(person.companyId)))
    ) {
      throw new HouseholdConflictError();
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
    if (
      (await this.isMemberOf(invite.householdId, companyId)) ||
      (await this.isInAnotherGroup(companyId))
    ) {
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

  private async isMemberOf(
    householdId: string,
    companyId: string,
  ): Promise<boolean> {
    const member = await this.prisma.householdMember.findUnique({
      where: { householdId_companyId: { householdId, companyId } },
      select: { id: true },
    });
    return Boolean(member);
  }

  /**
   * Regra do convite e do aceite antigos: quem está em algum grupo não entra em
   * outro. Só o individual próprio sem outros membros não conta, senão quem saiu
   * de um grupo depois de ganhá-lo no GET /account nunca mais seria convidado. O
   * individual com membros conta porque a migration marcou como individual todo
   * grupo existente, inclusive a família. O convite v2 (F3) troca esta regra
   * pelos limites de grupos.
   */
  private async isInAnotherGroup(companyId: string): Promise<boolean> {
    const other = await this.prisma.householdMember.findFirst({
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
    });
    return other !== null;
  }

  async revokeInvite(membership: ActiveMembership, inviteId: string) {
    const { householdId, role } = membership;
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

  async updateDisplayName(
    companyId: string,
    displayName: string,
    email?: string | null,
    requestedHouseholdId?: string,
  ): Promise<AccountView> {
    const name = displayName.trim();
    if (!name) {
      throw new HouseholdInvalidError('Informe um nome');
    }
    if (name.length > DISPLAY_NAME_MAX) {
      throw new HouseholdInvalidError(
        'O nome pode ter no máximo 32 caracteres',
      );
    }
    await this.prisma.personName.upsert({
      where: { companyId },
      create: {
        companyId,
        displayName: name,
        email: email?.trim().toLowerCase() || null,
      },
      update: { displayName: name },
    });
    return this.accountView(companyId, email, requestedHouseholdId);
  }

  async renameHousehold(membership: ActiveMembership, name: string) {
    const { householdId, role } = membership;
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

  async listPeople(
    membership: ActiveMembership,
  ): Promise<HouseholdPersonView[]> {
    const { householdId, companyId } = membership;
    const members = await this.prisma.householdMember.findMany({
      where: { householdId },
    });
    const names = await this.prisma.personName.findMany({
      where: { companyId: { in: members.map((member) => member.companyId) } },
    });
    const byCompany = new Map(
      names.map((person) => [person.companyId, person]),
    );
    const people: HouseholdPersonView[] = members.map((member) => {
      const person = byCompany.get(member.companyId);
      return {
        id: member.companyId,
        email: person?.email ?? '',
        displayName:
          person?.displayName?.trim() || person?.fullName?.trim() || 'Membro',
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

  async removeMember(membership: ActiveMembership, memberCompanyId: string) {
    const { householdId, role, companyId: actorId } = membership;
    if (role !== 'owner' || memberCompanyId === actorId) {
      throw new HouseholdForbiddenError();
    }
    const target = await this.prisma.householdMember.findUnique({
      where: {
        householdId_companyId: { householdId, companyId: memberCompanyId },
      },
    });
    if (!target || target.role === 'owner') {
      throw new HouseholdConflictError();
    }
    await this.prisma.householdMember.delete({
      where: {
        householdId_companyId: { householdId, companyId: memberCompanyId },
      },
    });
  }

  async leave(membership: ActiveMembership) {
    const { householdId, role, companyId } = membership;
    if (role === 'owner') {
      const others = await this.prisma.householdMember.count({
        where: { householdId, companyId: { not: companyId } },
      });
      if (others > 0) {
        throw new HouseholdForbiddenError(
          'O admin não sai enquanto houver outras pessoas no grupo',
        );
      }
      throw new HouseholdForbiddenError(
        'O último admin não pode sair. O grupo ficaria sem ninguém.',
      );
    }
    await this.prisma.householdMember.delete({
      where: { householdId_companyId: { householdId, companyId } },
    });
  }

  async clearMyData(membership: ActiveMembership, mode: 'expenses' | 'all') {
    const { householdId, companyId } = membership;
    await this.prisma.expense.deleteMany({
      where: { householdId, addedByCompanyId: companyId },
    });
    if (mode === 'all') {
      await this.prisma.lessonProgress.deleteMany({ where: { companyId } });
    }
  }
}

const HOUSEHOLD_SIZES = new Set([
  'solo',
  'two',
  'three_to_four',
  'five_or_more',
]);
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
    data.monthlyIncomeCents = readCents(
      body.monthlyIncomeCents,
      'monthlyIncomeCents',
    );
  }
  if (requireAll || body.reserveCents !== undefined) {
    data.reserveCents = readCents(body.reserveCents, 'reserveCents');
  }
  if (requireAll || body.priorities !== undefined) {
    if (
      !Array.isArray(body.priorities) ||
      body.priorities.some((item) => typeof item !== 'string')
    ) {
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

const GOAL_IDS = new Set<string>([
  'gastos',
  'reserva',
  'familia',
  'aprender',
  'investir',
]);
const IMPORT_IDS = new Set<string>(['ofx', 'nfe', 'manual']);
const FAMILIARITY_IDS = new Set<string>([
  'nunca',
  'ouvi',
  'comprei',
  'frequente',
]);
const ACTION_IDS = new Set<string>([
  'corretora',
  'transferi',
  'stable',
  'rendimento',
  'autocustodia',
]);

function readComplete(body: CompleteOnboarding) {
  if (!body || typeof body !== 'object') {
    throw new HouseholdInvalidError('onboarding is invalid');
  }
  return {
    fullName: readOptionalName(body.fullName, 'fullName', 32),
    displayName: readOptionalName(body.displayName, 'displayName', 32),
    goals: readIdList(body.goals, GOAL_IDS, 'goals') as OnboardingGoal[],
    importMode: readOptionalId(
      body.importMode,
      IMPORT_IDS,
      'importMode',
    ) as ImportMode | null,
    cryptoFamiliarity: readOptionalId(
      body.cryptoFamiliarity,
      FAMILIARITY_IDS,
      'cryptoFamiliarity',
    ) as CryptoFamiliarity | null,
    cryptoActions: readIdList(
      body.cryptoActions,
      ACTION_IDS,
      'cryptoActions',
    ) as CryptoAction[],
    showFreedom: readFlag(body.showFreedom, 'showFreedom'),
    showFamily: readFlag(body.showFamily, 'showFamily'),
    learnCrypto: readFlag(body.learnCrypto, 'learnCrypto'),
  };
}

function readOptionalName(
  value: unknown,
  field: string,
  max: number,
): string | null {
  if (value == null) return null;
  if (typeof value !== 'string')
    throw new HouseholdInvalidError(`${field} is invalid`);
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

function readOptionalId(
  value: unknown,
  allowed: Set<string>,
  field: string,
): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new HouseholdInvalidError(`${field} is invalid`);
  }
  return value;
}

function readIdList(
  value: unknown,
  allowed: Set<string>,
  field: string,
): string[] {
  if (!Array.isArray(value)) {
    throw new HouseholdInvalidError(`${field} is invalid`);
  }
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item)) {
      throw new HouseholdInvalidError(`${field} is invalid`);
    }
    items.push(item);
  }
  return [...new Set(items)];
}

function readFlag(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean')
    throw new HouseholdInvalidError(`${field} is invalid`);
  return value;
}

function readFlags(body: PatchHouseholdProfile): {
  showFreedom?: boolean;
  showFamily?: boolean;
} {
  const data: { showFreedom?: boolean; showFamily?: boolean } = {};
  if (body.showFreedom !== undefined)
    data.showFreedom = readFlag(body.showFreedom, 'showFreedom');
  if (body.showFamily !== undefined)
    data.showFamily = readFlag(body.showFamily, 'showFamily');
  return data;
}

function firstWord(value: string | null): string | null {
  const word = value?.trim().split(/\s+/)[0] ?? '';
  return word || null;
}

function readCents(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new HouseholdInvalidError(`${field} is invalid`);
  }
  return value;
}
