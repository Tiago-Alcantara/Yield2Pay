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

export type ExpenseWritePlan = {
  inserts: PlannedExpense[];
  markFixed: string[];
  unmarkFixed: string[];
  sharedKeyUpdates: Map<string, string[]>;
};

function calendarDay(spentOn: Date | string): string {
  if (spentOn instanceof Date) return spentOn.toISOString().slice(0, 10);
  return spentOn.slice(0, 10);
}

/** Chaves que o índice consegue achar para o grupo deste estabelecimento. */
export function groupLookupKeys(merchants: readonly string[]): string[] {
  const keys = new Set<string>();
  for (const merchant of merchants) {
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

/** Filtro que usa o índice (household_id, shared_merchant_key). */
export function expenseGroupWhere(
  householdId: string,
  merchants: readonly string[],
) {
  const keys = groupLookupKeys(merchants);
  if (keys.length === 0) return null;
  return {
    householdId,
    sharedMerchantKey: { in: keys },
  };
}

/**
 * Chaves e flag do lote. `recompute` relê o grupo inteiro (apagar ou reclassificar).
 * fixed=true marcado à mão não volta para false.
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
    const manual = row.fixedManual === true && row.fixed === true;
    if (should && row.fixed !== true) markFixed.push(row.id);
    if (!should && row.fixed === true && !manual) unmarkFixed.push(row.id);
    if ((row.sharedMerchantKey ?? '') !== after) {
      const bucket = sharedKeyUpdates.get(after) ?? [];
      bucket.push(row.id);
      sharedKeyUpdates.set(after, bucket);
    }
  });
  return { inserts, markFixed, unmarkFixed, sharedKeyUpdates };
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
  if (row.fixedManual === true && row.fixed) return true;
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

export async function loadLegacyFixedIds(
  db: Pick<PrismaClient, 'expense'>,
  householdId: string,
): Promise<ReadonlySet<string> | null> {
  const probe = await db.expense.findFirst({
    where: { householdId, merchantKey: '' },
    select: { id: true },
  });
  if (!probe) return null;
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

export async function writeExpensePlan(
  tx: Prisma.TransactionClient,
  plan: ExpenseWritePlan,
): Promise<void> {
  if (plan.markFixed.length > 0) {
    await tx.expense.updateMany({
      where: { id: { in: plan.markFixed } },
      data: { fixed: true },
    });
  }
  if (plan.unmarkFixed.length > 0) {
    await tx.expense.updateMany({
      where: { id: { in: plan.unmarkFixed }, fixedManual: false },
      data: { fixed: false },
    });
  }
  for (const [sharedKey, ids] of plan.sharedKeyUpdates) {
    if (ids.length === 0) continue;
    await tx.expense.updateMany({
      where: { id: { in: ids } },
      data: { sharedMerchantKey: sharedKey },
    });
  }
}

export { GROUP_SELECT };
