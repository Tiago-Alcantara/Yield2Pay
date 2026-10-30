/**
 * Módulo: backfill-preview
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: Mostra o que a simulação preencheria, sem gravar.
 * Sequência: calcula chave, chave compartilhada e flag; recusa --apply e banco remoto.
 */
import { idsToMarkFixed, merchantKey, sharedMerchantKey } from './classify';

export type StoredExpenseKeys = {
  id: string;
  merchant: string;
  spentOn: string;
  amountCents: number;
  category: string;
  fixed: boolean;
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

export function previewHouseholdBackfill(rows: StoredExpenseKeys[]): ExpenseKeyChange[] {
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
    if (row.sharedMerchantKey !== nextShared) change.sharedMerchantKey = nextShared;
    if (row.fixed !== nextFixed) change.fixed = nextFixed;
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

export function assertSimulationOnly(argv: readonly string[]): void {
  if (argv.some((arg) => arg === '--apply' || arg.startsWith('--apply='))) {
    throw new Error('recusado: este script só simula e não grava');
  }
}

export function assertLocalDatabaseUrl(databaseUrl: string): void {
  let hostname = '';
  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    throw new Error('recusado: DATABASE_URL inválida');
  }
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error('recusado: o banco não é local');
  }
}
