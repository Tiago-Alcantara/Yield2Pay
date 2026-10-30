import { Prisma, type PrismaClient } from '@prisma/client';
import { idsToMarkFixed, merchantKey, sharedMerchantKey } from './classify';

export type ExpenseSnapshot = {
  id: string;
  merchant: string;
  spentOn: Date | string;
  amountCents: number;
  category: string;
  fixed?: boolean;
  fixedManual?: boolean;
  merchantKey?: string | null;
  sharedMerchantKey?: string | null;
};

export type IncomingExpense = {
  merchant: string;
  spentOn: string;
  amountCents: number;
  category: string;
};

export type PlannedExpense = IncomingExpense & {
  merchantKey: string;
  sharedMerchantKey: string;
  fixed: boolean;
};

export type KeyUpdate = {
  id: string;
  merchantKey: string;
  sharedMerchantKey: string;
};

export type ExpenseWritePlan = {
  inserts: PlannedExpense[];
  markFixed: string[];
  unmarkFixed: string[];
  sharedKeyUpdates: Map<string, string[]>;
  keyUpdates: KeyUpdate[];
};

function calendarDay(spentOn: Date | string): string {
  if (spentOn instanceof Date) return spentOn.toISOString().slice(0, 10);
  return spentOn.slice(0, 10);
}

/** Chaves que o índice e o prefixo conseguem achar para este estabelecimento. */
export function groupLookupKeys(merchants: readonly string[]): string[] {
  const keys = new Set<string>();
  for (const merchant of merchants) {
    if (typeof merchant !== 'string') continue;
    const key = merchantKey(merchant);
    if (!key) continue;
    keys.add(key);
    const parts = key.split(' ');
    let prefix = '';
    for (let index = 0; index < parts.length; index += 1) {
      prefix =
        index === 0 ? (parts[0] ?? '') : `${prefix} ${parts[index] ?? ''}`;
      if (prefix.length >= 4) keys.add(prefix);
    }
  }
  return [...keys];
}

/**
 * Primeira palavra da chave, em ordem estável. Dois creates do mesmo grupo
 * pegam o mesmo cadeado.
 */
export function groupLockKeys(merchants: readonly string[]): string[] {
  const keys = new Set<string>();
  for (const merchant of merchants) {
    if (typeof merchant !== 'string') continue;
    const key = merchantKey(merchant);
    if (!key) continue;
    const first = key.split(' ')[0] ?? key;
    keys.add(first.length >= 4 ? first : key);
  }
  return [...keys].sort();
}

/**
 * Filtro do grupo: chave vazia (histórico antigo), a chave em si e o prefixo
 * diferente (`netflix premium` quando entra `netflix`).
 */
export function expenseGroupWhere(
  householdId: string,
  merchants: readonly string[],
) {
  const keys = groupLookupKeys(merchants);
  if (keys.length === 0) return null;
  return {
    householdId,
    OR: [
      { merchantKey: '' },
      { sharedMerchantKey: '' },
      { merchantKey: { in: keys } },
      { sharedMerchantKey: { in: keys } },
      ...keys.map((key) => ({ merchantKey: { startsWith: `${key} ` } })),
      ...keys.map((key) => ({ sharedMerchantKey: { startsWith: `${key} ` } })),
    ],
  };
}

/** Linhas que a classificação global poria no mesmo grupo destes estabelecimentos. */
export function rowsInMerchantGroup(
  existing: ExpenseSnapshot[],
  merchants: readonly string[],
): ExpenseSnapshot[] {
  const incomingKeys = merchants.map((merchant) => merchantKey(merchant));
  const existingKeys = existing.map((row) => merchantKey(row.merchant));
  const keySet = new Set(
    [...existingKeys, ...incomingKeys].filter((key) => key.length > 0),
  );
  const wanted = new Set(
    incomingKeys
      .filter((key) => key.length > 0)
      .map((key) => sharedMerchantKey(key, keySet)),
  );
  if (wanted.size === 0) return [];
  return existing.filter((row, index) => {
    const key = existingKeys[index] ?? '';
    if (!key) return false;
    return wanted.has(sharedMerchantKey(key, keySet));
  });
}

/**
 * Chaves e flag do lote. `recompute` relê o grupo inteiro (apagar ou reclassificar).
 * fixed manual, true ou false, não é reescrito.
 */
export function planExpenseWrite(
  existing: ExpenseSnapshot[],
  incoming: IncomingExpense[],
  recompute = false,
): ExpenseWritePlan {
  const existingDays = existing.map((row) => ({
    id: row.id,
    merchant: row.merchant,
    spentOn: calendarDay(row.spentOn),
    amountCents: row.amountCents,
    category: row.category,
  }));
  const incomingDays = incoming.map((row, index) => ({
    id: `incoming:${index}`,
    merchant: row.merchant,
    spentOn: calendarDay(row.spentOn),
    amountCents: row.amountCents,
    category: row.category,
  }));
  const all = [...existingDays, ...incomingDays];
  const allKeys = all.map((row) => merchantKey(row.merchant));
  const keySet = new Set(allKeys);
  const existingKeySet = new Set(allKeys.slice(0, existingDays.length));
  const fixed = new Set(idsToMarkFixed(all));
  const inserts: PlannedExpense[] = incoming.map((row, index) => {
    const key =
      allKeys[existingDays.length + index] ?? merchantKey(row.merchant);
    return {
      merchant: row.merchant,
      spentOn: calendarDay(row.spentOn),
      amountCents: row.amountCents,
      category: row.category,
      merchantKey: key,
      sharedMerchantKey: sharedMerchantKey(key, keySet),
      fixed: fixed.has(`incoming:${index}`),
    };
  });
  const incomingShared = new Set(inserts.map((row) => row.sharedMerchantKey));
  const incomingKeys = new Set(inserts.map((row) => row.merchantKey));
  const markFixed: string[] = [];
  const unmarkFixed: string[] = [];
  const sharedKeyUpdates = new Map<string, string[]>();
  const keyUpdates: KeyUpdate[] = [];
  existing.forEach((row, index) => {
    const key = allKeys[index] ?? '';
    const before = sharedMerchantKey(key, existingKeySet);
    const after = sharedMerchantKey(key, keySet);
    const affected =
      recompute ||
      before !== after ||
      incomingShared.has(after) ||
      incomingKeys.has(key);
    if (!affected) return;
    const should = fixed.has(row.id);
    const manual = row.fixedManual === true;
    if (!manual && should && row.fixed !== true) markFixed.push(row.id);
    if (!manual && !should && row.fixed === true) unmarkFixed.push(row.id);
    if ((row.sharedMerchantKey ?? '') !== after) {
      const bucket = sharedKeyUpdates.get(after) ?? [];
      bucket.push(row.id);
      sharedKeyUpdates.set(after, bucket);
    }
    if (
      (row.merchantKey ?? '') !== key ||
      (row.sharedMerchantKey ?? '') !== after
    ) {
      keyUpdates.push({
        id: row.id,
        merchantKey: key,
        sharedMerchantKey: after,
      });
    }
  });
  return { inserts, markFixed, unmarkFixed, sharedKeyUpdates, keyUpdates };
}

/** Flag mostrada na leitura. Linha sem chave usa o cálculo em memória; a marca manual permanece. */
export function fixedForRead(
  row: {
    id: string;
    fixed: boolean;
    fixedManual?: boolean;
    merchantKey?: string | null;
  },
  legacyFixed: ReadonlySet<string> | null,
): boolean {
  if ((row.merchantKey ?? '') !== '') return row.fixed;
  if (row.fixedManual === true) return row.fixed;
  if (!legacyFixed) return row.fixed;
  return legacyFixed.has(row.id);
}

const GROUP_SELECT = {
  id: true,
  merchant: true,
  spentOn: true,
  amountCents: true,
  category: true,
  fixed: true,
  fixedManual: true,
  merchantKey: true,
  sharedMerchantKey: true,
} as const;

const householdsWithoutLegacyKeys = new Set<string>();

/** Os testes reutilizam o mesmo id de casa no mesmo processo. */
export function clearLegacyKeyCache(): void {
  householdsWithoutLegacyKeys.clear();
}

export async function loadLegacyFixedIds(
  db: Pick<PrismaClient, 'expense'>,
  householdId: string,
): Promise<ReadonlySet<string> | null> {
  if (householdsWithoutLegacyKeys.has(householdId)) return null;
  const probe = await db.expense.findFirst({
    where: { householdId, merchantKey: '' },
    select: { id: true },
  });
  if (!probe) {
    householdsWithoutLegacyKeys.add(householdId);
    return null;
  }
  const rows = await db.expense.findMany({
    where: { householdId, merchantKey: '' },
    select: {
      id: true,
      merchant: true,
      spentOn: true,
      amountCents: true,
      category: true,
    },
  });
  return new Set(
    idsToMarkFixed(
      rows.map((row) => ({
        id: row.id,
        merchant: row.merchant,
        spentOn:
          row.spentOn instanceof Date
            ? row.spentOn.toISOString().slice(0, 10)
            : String(row.spentOn).slice(0, 10),
        amountCents: row.amountCents,
        category: row.category,
      })),
    ),
  );
}

type GroupClient = Prisma.TransactionClient;

export async function lockExpenseGroups(
  tx: GroupClient,
  householdId: string,
  merchants: readonly string[],
): Promise<void> {
  for (const lockKey of groupLockKeys(merchants)) {
    // O FROM obriga o Postgres a executar o lock. Um SELECT solto devolve
    // void e o adapter do Prisma não lê; um CTE não referenciado pode ser pulado.
    await tx.$queryRaw`
      SELECT 1 AS locked
      FROM (
        SELECT pg_advisory_xact_lock(hashtext(${householdId}), hashtext(${lockKey})) AS acquired
      ) AS lock_row
    `;
  }
}

export async function loadExpenseGroup(
  tx: GroupClient,
  householdId: string,
  merchants: readonly string[],
): Promise<ExpenseSnapshot[]> {
  const where = expenseGroupWhere(householdId, merchants);
  if (!where) return [];
  const rows = await tx.expense.findMany({
    where,
    select: GROUP_SELECT,
  });
  return rowsInMerchantGroup(rows ?? [], merchants);
}

export async function writeExpensePlan(
  tx: GroupClient,
  householdId: string,
  plan: ExpenseWritePlan,
): Promise<void> {
  if (plan.markFixed.length > 0) {
    await tx.expense.updateMany({
      where: {
        id: { in: plan.markFixed },
        householdId,
        fixedManual: false,
      },
      data: { fixed: true },
    });
  }
  if (plan.unmarkFixed.length > 0) {
    await tx.expense.updateMany({
      where: {
        id: { in: plan.unmarkFixed },
        householdId,
        fixedManual: false,
      },
      data: { fixed: false },
    });
  }
  const buckets = new Map<string, KeyUpdate & { ids: string[] }>();
  for (const update of plan.keyUpdates) {
    const stamp = `${update.merchantKey}\0${update.sharedMerchantKey}`;
    const bucket = buckets.get(stamp);
    if (bucket) bucket.ids.push(update.id);
    else
      buckets.set(stamp, {
        ...update,
        ids: [update.id],
      });
  }
  for (const bucket of buckets.values()) {
    await tx.expense.updateMany({
      where: { id: { in: bucket.ids }, householdId },
      data: {
        merchantKey: bucket.merchantKey,
        sharedMerchantKey: bucket.sharedMerchantKey,
      },
    });
  }
}

export { GROUP_SELECT };
