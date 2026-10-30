import { idsToMarkFixed, merchantKey, sharedMerchantKey } from './classify';

export type ExpenseSnapshot = {
  id: string;
  merchant: string;
  spentOn: Date | string;
  amountCents: number;
  category: string;
  fixed?: boolean;
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

function calendarDay(spentOn: Date | string): string {
  if (spentOn instanceof Date) return spentOn.toISOString().slice(0, 10);
  return spentOn.slice(0, 10);
}

/** Chaves e flag fixa de um lote novo, mais as linhas antigas do mesmo grupo que mudam. */
export function planExpenseWrite(existing: ExpenseSnapshot[], incoming: IncomingExpense[]) {
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
    const key = allKeys[existingDays.length + index] ?? merchantKey(row.merchant);
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
  const sharedKeyUpdates = new Map<string, string[]>();
  existing.forEach((row, index) => {
    const key = allKeys[index] ?? '';
    const before = sharedMerchantKey(key, existingKeySet);
    const after = sharedMerchantKey(key, keySet);
    const affected = before !== after || incomingShared.has(after) || incomingKeys.has(key);
    if (!affected) return;
    if (fixed.has(row.id) && row.fixed !== true) markFixed.push(row.id);
    if ((row.sharedMerchantKey ?? '') !== after) {
      const bucket = sharedKeyUpdates.get(after) ?? [];
      bucket.push(row.id);
      sharedKeyUpdates.set(after, bucket);
    }
  });
  return { inserts, markFixed, sharedKeyUpdates };
}
