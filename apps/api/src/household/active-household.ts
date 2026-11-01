import { Prisma } from '@prisma/client';
import type { HouseholdRole } from '@yield2pay/shared';
import type { ActiveMembership } from '../auth/authenticated-request';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdNotFoundError } from './household.errors';

/** Nome do grupo individual criado no primeiro acesso de um membro antigo. */
export const PERSONAL_HOUSEHOLD_DEFAULT_NAME = 'Meu grupo';

/**
 * Os ids de grupo saem do cuid() do Prisma: letras minúsculas e dígitos,
 * começando por letra. A faixa de tamanho aceita o cuid (25) e o cuid2 (24).
 */
const HOUSEHOLD_ID_FORMAT = /^[a-z][a-z0-9]{19,31}$/;

export function isWellFormedHouseholdId(value: string): boolean {
  return HOUSEHOLD_ID_FORMAT.test(value);
}

/**
 * Lê o header X-Household-Id. undefined = header ausente.
 * O Express junta headers repetidos com ", ", o que já falha no formato.
 */
export function readRequestedHouseholdId(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const value = headers['x-household-id'];
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value.join(', ') : value;
}

/**
 * Serializa a criação do grupo individual de uma pessoa. A chave sai do
 * companyId; o primeiro número separa este lock dos locks de grupo de gasto
 * (fixed-flags.ts), que usam hashtext(householdId).
 */
export async function lockPersonalHousehold(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<void> {
  // O FROM obriga o Postgres a executar o lock. Um SELECT solto devolve
  // void e o adapter do Prisma não lê.
  await tx.$queryRaw`
    SELECT 1 AS locked
    FROM (
      SELECT pg_advisory_xact_lock(hashtext('household-personal'), hashtext(${companyId})) AS acquired
    ) AS lock_row
  `;
}

/**
 * Quem entrou num grupo alheio pelo aceite antigo e ainda não tem grupo
 * próprio ganha o grupo individual (personal = true), com a própria
 * membership de owner. Quem não está em grupo nenhum não ganha nada aqui:
 * cria o primeiro pelo POST /households.
 *
 * Idempotente. Duas chamadas ao mesmo tempo se enfileiram no advisory lock;
 * a segunda acha o grupo criado pela primeira. O índice único parcial
 * (owner_company_id) WHERE personal barra qualquer caminho que escape do lock.
 *
 * Devolve true só quando criou o grupo.
 */
export async function ensurePersonalHousehold(
  prisma: PrismaService,
  companyId: string,
): Promise<boolean> {
  const memberships = await prisma.householdMember.findMany({
    where: { companyId },
    select: {
      household: { select: { ownerCompanyId: true, personal: true } },
    },
  });
  if (memberships.length === 0) {
    return false;
  }
  const hasPersonalHousehold = memberships.some(
    (membership) =>
      membership.household.personal &&
      membership.household.ownerCompanyId === companyId,
  );
  if (hasPersonalHousehold) {
    return false;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await lockPersonalHousehold(tx, companyId);
      const existing = await tx.household.findFirst({
        where: { ownerCompanyId: companyId, personal: true },
        select: { id: true },
      });
      if (existing) {
        return false;
      }
      const household = await tx.household.create({
        data: {
          name: PERSONAL_HOUSEHOLD_DEFAULT_NAME,
          ownerCompanyId: companyId,
          personal: true,
        },
      });
      await tx.householdMember.create({
        data: { householdId: household.id, companyId, role: 'owner' },
      });
      return true;
    });
  } catch (error) {
    // Outro caminho criou o individual entre a leitura e o insert: o índice
    // parcial recusou o segundo. O grupo que vale já existe.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Resolve o grupo ativo do pedido.
 *
 * Com header: o id precisa ter o formato de id de grupo e a pessoa precisa
 * ser membro dele. Id malformado e grupo alheio dão o mesmo
 * HouseholdNotFoundError (404), para não revelar se o grupo existe.
 *
 * Sem header: a única membership da pessoa; com mais de uma, o grupo
 * individual.
 */
export async function resolveActiveHousehold(
  prisma: PrismaService,
  companyId: string,
  requestedHouseholdId: string | undefined,
): Promise<ActiveMembership> {
  if (requestedHouseholdId !== undefined) {
    if (!isWellFormedHouseholdId(requestedHouseholdId)) {
      throw new HouseholdNotFoundError();
    }
  }

  await ensurePersonalHousehold(prisma, companyId);

  if (requestedHouseholdId !== undefined) {
    const member = await prisma.householdMember.findUnique({
      where: {
        householdId_companyId: { householdId: requestedHouseholdId, companyId },
      },
      select: {
        householdId: true,
        role: true,
        household: { select: { ownerCompanyId: true, personal: true } },
      },
    });
    if (!member) {
      throw new HouseholdNotFoundError();
    }
    return {
      householdId: member.householdId,
      companyId,
      role: member.role as HouseholdRole,
      personal:
        member.household.personal &&
        member.household.ownerCompanyId === companyId,
    };
  }

  const memberships = await prisma.householdMember.findMany({
    where: { companyId },
    select: {
      householdId: true,
      role: true,
      household: { select: { ownerCompanyId: true, personal: true } },
    },
  });
  if (memberships.length === 0) {
    throw new HouseholdNotFoundError();
  }
  const personalMembership = memberships.find(
    (membership) =>
      membership.household.personal &&
      membership.household.ownerCompanyId === companyId,
  );
  const chosen = memberships.length === 1 ? memberships[0] : personalMembership;
  if (!chosen) {
    // Com mais de um grupo o ensurePersonalHousehold já garantiu o individual.
    throw new HouseholdNotFoundError();
  }
  return {
    householdId: chosen.householdId,
    companyId,
    role: chosen.role as HouseholdRole,
    personal: chosen === personalMembership,
  };
}
