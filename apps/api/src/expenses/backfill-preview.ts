/**
 * Módulo: backfill-preview
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: Calcula o que gravar nas chaves e só aceita banco local de teste.
 * Sequência: preserva fixed manual; recusa host na query, socket e banco que não é de teste.
 */
import { parse } from 'pg-connection-string';
import { idsToMarkFixed, merchantKey, sharedMerchantKey } from './classify';

export type StoredExpenseKeys = {
  id: string;
  merchant: string;
  spentOn: string;
  amountCents: number;
  category: string;
  fixed: boolean;
  fixedManual?: boolean;
  merchantKey: string;
  sharedMerchantKey: string;
};

export type ExpenseKeyChange = {
  id: string;
  merchantKey?: string;
  sharedMerchantKey?: string;
  fixed?: boolean;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const QUERY_HOST = /^(host|hostaddr)$/i;

export function previewHouseholdBackfill(
  rows: StoredExpenseKeys[],
): ExpenseKeyChange[] {
  const keys = rows.map((row) => merchantKey(row.merchant));
  const keySet = new Set(keys);
  const shared = keys.map((key) => sharedMerchantKey(key, keySet));
  const fixedIds = new Set(
    idsToMarkFixed(
      rows.map((row) => ({
        id: row.id,
        merchant: row.merchant,
        spentOn: row.spentOn,
        amountCents: row.amountCents,
        category: row.category,
      })),
    ),
  );
  const changes: ExpenseKeyChange[] = [];
  rows.forEach((row, index) => {
    const nextKey = keys[index] ?? '';
    const nextShared = shared[index] ?? nextKey;
    const nextFixed = fixedIds.has(row.id);
    const change: ExpenseKeyChange = { id: row.id };
    if (row.merchantKey !== nextKey) change.merchantKey = nextKey;
    if (row.sharedMerchantKey !== nextShared)
      change.sharedMerchantKey = nextShared;
    const manual = row.fixedManual === true && row.fixed === true;
    if (row.fixed !== nextFixed && !(manual && !nextFixed))
      change.fixed = nextFixed;
    if (
      change.merchantKey !== undefined ||
      change.sharedMerchantKey !== undefined ||
      change.fixed !== undefined
    ) {
      changes.push(change);
    }
  });
  return changes;
}

export type KeyWriter = {
  expense: {
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  $transaction<T>(fn: (tx: KeyWriter) => Promise<T>): Promise<T>;
};

export async function applyKeyChanges(
  writer: KeyWriter,
  changes: ExpenseKeyChange[],
  batchSize = 100,
): Promise<{ batches: number; rows: number }> {
  const size = Math.max(1, batchSize);
  let batches = 0;
  let rows = 0;
  for (let index = 0; index < changes.length; index += size) {
    const batch = changes.slice(index, index + size);
    await writer.$transaction(async (tx) => {
      for (const change of batch) {
        const data: Record<string, unknown> = {};
        if (change.merchantKey !== undefined)
          data.merchantKey = change.merchantKey;
        if (change.sharedMerchantKey !== undefined)
          data.sharedMerchantKey = change.sharedMerchantKey;
        if (change.fixed !== undefined) data.fixed = change.fixed;
        if (Object.keys(data).length === 0) continue;
        await tx.expense.update({ where: { id: change.id }, data });
        rows += 1;
      }
    });
    batches += 1;
  }
  return { batches, rows };
}

export function assertLocalDatabaseUrl(databaseUrl: string): void {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(databaseUrl);
  } catch {
    throw new Error('recusado: DATABASE_URL inválida');
  }
  const query = databaseUrl.includes('?')
    ? databaseUrl.slice(databaseUrl.indexOf('?') + 1)
    : '';
  const params = new URLSearchParams(query);
  for (const key of params.keys()) {
    if (QUERY_HOST.test(key)) {
      throw new Error('recusado: host na query');
    }
  }
  const host = String(parsed.host ?? '').replace(/^\[|\]$/g, '');
  if (!host || host.startsWith('/') || host.includes('/')) {
    throw new Error('recusado: socket não é banco local');
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error('recusado: o banco não é local');
  }
  const database = parsed.database ?? '';
  if (!/test/i.test(database)) {
    throw new Error('recusado: o banco precisa ser de teste');
  }
}
