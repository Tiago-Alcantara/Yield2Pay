/**
 * Módulo: backfill-preview
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: Calcula o que gravar nas chaves e trava banco local ou produção confirmada.
 * Sequência: sufixo _test e porta no local; produção exige o nome do banco e uma simulação anterior.
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

export type DatabaseTarget = {
  host: string;
  port: string;
  database: string;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const LOCAL_PORTS = new Set(['5432', '5433']);
const QUERY_TARGET = /^(host|hostaddr|port)$/i;

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
    if (row.sharedMerchantKey !== nextShared) {
      change.sharedMerchantKey = nextShared;
    }
    const manual = row.fixedManual === true;
    const wouldClear = row.fixed === true && !nextFixed;
    if (!manual && !wouldClear && row.fixed !== nextFixed) {
      change.fixed = nextFixed;
    }
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
  $executeRaw?(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown>;
  $transaction<T>(fn: (tx: KeyWriter) => Promise<T>): Promise<T>;
};

export async function applyKeyChanges(
  writer: KeyWriter,
  changes: ExpenseKeyChange[],
  batchSize = 100,
  log: (message: string) => void = () => undefined,
): Promise<{ batches: number; rows: number }> {
  const size = Math.max(1, batchSize);
  let batches = 0;
  let rows = 0;
  for (let index = 0; index < changes.length; index += size) {
    const batch = changes.slice(index, index + size);
    const started = Date.now();
    await writer.$transaction(async (tx) => {
      if (tx.$executeRaw) {
        await tx.$executeRaw`SELECT set_config('lock_timeout', '4s', true)`;
        await tx.$executeRaw`SELECT set_config('statement_timeout', '60s', true)`;
      }
      for (const change of batch) {
        const data: Record<string, unknown> = {};
        if (change.merchantKey !== undefined) {
          data.merchantKey = change.merchantKey;
        }
        if (change.sharedMerchantKey !== undefined) {
          data.sharedMerchantKey = change.sharedMerchantKey;
        }
        if (change.fixed === true) data.fixed = true;
        if (Object.keys(data).length === 0) continue;
        await tx.expense.update({ where: { id: change.id }, data });
        rows += 1;
      }
    });
    batches += 1;
    log(
      `lote ${batches}: ${batch.length} linhas em ${Date.now() - started} ms`,
    );
  }
  return { batches, rows };
}

export function describeDatabaseUrl(databaseUrl: string): DatabaseTarget {
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
    if (QUERY_TARGET.test(key)) {
      throw new Error(
        key.toLowerCase() === 'port'
          ? 'recusado: porta na query'
          : 'recusado: host na query',
      );
    }
  }
  const host = String(parsed.host ?? '').replace(/^\[|\]$/g, '');
  if (!host || host.startsWith('/') || host.includes('/')) {
    throw new Error('recusado: socket não é banco local');
  }
  const port = parsed.port ? String(parsed.port) : '5432';
  const database = parsed.database ?? '';
  if (!database) throw new Error('recusado: banco ausente');
  return { host, port, database };
}

export function assertLocalDatabaseUrl(databaseUrl: string): DatabaseTarget {
  const target = describeDatabaseUrl(databaseUrl);
  if (!LOCAL_HOSTS.has(target.host)) {
    throw new Error('recusado: o banco não é local');
  }
  if (!LOCAL_PORTS.has(target.port)) {
    throw new Error('recusado: a porta não é a do Postgres local');
  }
  if (!target.database.endsWith('_test')) {
    throw new Error('recusado: o banco precisa ser de teste');
  }
  return target;
}

export function assertProductionApply(
  databaseUrl: string,
  confirmedName: string,
  stamp: DatabaseTarget | null,
): DatabaseTarget {
  const target = describeDatabaseUrl(databaseUrl);
  if (!confirmedName || confirmedName !== target.database) {
    throw new Error('recusado: o nome confirmado não é o do banco');
  }
  if (
    !stamp ||
    stamp.database !== target.database ||
    stamp.host !== target.host ||
    stamp.port !== target.port
  ) {
    throw new Error('recusado: rode a simulação antes, no mesmo banco');
  }
  return target;
}
