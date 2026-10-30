/**
 * Preenche merchant_key, shared_merchant_key e fixed.
 * Sem --apply só lê e grava o carimbo da simulação.
 * Com --apply grava em lotes, uma transação por lote.
 * Local: host loopback, porta 5432 ou 5433, nome terminando em _test.
 * Produção: --confirm-production <nome> igual ao da DATABASE_URL, depois de uma simulação.
 * Quem roda em produção é o Tiago, na publicação. Este comando não é chamado daqui.
 */
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  applyKeyChanges,
  assertLocalDatabaseUrl,
  assertProductionApply,
  previewHouseholdBackfill,
  type DatabaseTarget,
} from '../src/expenses/backfill-preview';

const STAMP_PATH = '/tmp/yield2pay-backfill-preview.json';
const SNAPSHOT_DIR = '/tmp/yield2pay-backfill-snapshots';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return undefined;
  return value;
}

function readStamp(): DatabaseTarget | null {
  try {
    const parsed = JSON.parse(
      readFileSync(STAMP_PATH, 'utf8'),
    ) as DatabaseTarget;
    if (!parsed.database || !parsed.host || !parsed.port) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const confirmedName = readArg('--confirm-production');
  const batchArg = readArg('--batch-size');
  const batchSize = batchArg ? Number(batchArg) : 100;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    fail('recusado: --batch-size precisa ser um inteiro de 1 a 5000');
  }
  if (process.argv.includes('--confirm-production') && !confirmedName) {
    fail('recusado: --confirm-production precisa do nome do banco');
  }
  if (confirmedName && !apply) {
    fail('recusado: --confirm-production só vale com --apply');
  }

  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl) fail('recusado: DATABASE_URL ausente');
  let target: DatabaseTarget;
  try {
    target = confirmedName
      ? assertProductionApply(databaseUrl, confirmedName, readStamp())
      : assertLocalDatabaseUrl(databaseUrl);
  } catch (error) {
    fail(error instanceof Error ? error.message : 'recusado');
  }

  const started = Date.now();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const before = await prisma.expense.count();
  const households = await prisma.household.findMany({ select: { id: true } });
  let rowsRead = 0;
  let wouldChangeKey = 0;
  let wouldChangeSharedKey = 0;
  let wouldChangeFixed = 0;
  let batches = 0;
  let rowsWritten = 0;
  const snapshot: Array<{ id: string; fixed: boolean }> = [];
  const pending: ReturnType<typeof previewHouseholdBackfill> = [];
  for (const household of households) {
    const rows = await prisma.expense.findMany({
      where: { householdId: household.id },
      select: {
        id: true,
        merchant: true,
        spentOn: true,
        amountCents: true,
        category: true,
        fixed: true,
        fixedManual: true,
        merchantKey: true,
        sharedMerchantKey: true,
      },
    });
    rowsRead += rows.length;
    for (const row of rows) snapshot.push({ id: row.id, fixed: row.fixed });
    const changes = previewHouseholdBackfill(
      rows.map((row) => ({
        id: row.id,
        merchant: row.merchant,
        spentOn: row.spentOn.toISOString().slice(0, 10),
        amountCents: row.amountCents,
        category: row.category,
        fixed: row.fixed,
        fixedManual: row.fixedManual,
        merchantKey: row.merchantKey,
        sharedMerchantKey: row.sharedMerchantKey,
      })),
    );
    for (const change of changes) {
      if (change.merchantKey !== undefined) wouldChangeKey += 1;
      if (change.sharedMerchantKey !== undefined) wouldChangeSharedKey += 1;
      if (change.fixed !== undefined) wouldChangeFixed += 1;
    }
    pending.push(...changes);
  }

  if (!apply) {
    writeFileSync(
      STAMP_PATH,
      JSON.stringify(
        { database: target.database, host: target.host, port: target.port },
        null,
        2,
      ),
    );
    console.log(
      `Simulação gravada em ${STAMP_PATH}. Nada foi gravado no banco.`,
    );
  } else {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const snapshotPath = `${SNAPSHOT_DIR}/fixed-${Date.now()}.json`;
    writeFileSync(snapshotPath, JSON.stringify(snapshot));
    console.log(
      `Snapshot da coluna fixed: ${snapshotPath} (${snapshot.length} linhas).`,
    );
    if (pending.length > 0) {
      const written = await applyKeyChanges(
        prisma,
        pending,
        batchSize,
        (message) => console.log(message),
      );
      batches = written.batches;
      rowsWritten = written.rows;
    }
  }

  const after = await prisma.expense.count();
  await prisma.$disconnect();
  const ms = Date.now() - started;
  if (before !== after) fail('o preenchimento alterou a contagem de despesas');
  if (apply) {
    console.log(
      `Gravou ${rowsWritten} linhas em ${batches} lotes em ${ms} ms.`,
    );
  }
  console.log(
    JSON.stringify(
      {
        modo: apply ? 'gravacao' : 'simulacao',
        gravou: apply,
        banco: target.database,
        porta: target.port,
        casas: households.length,
        despesasLidas: rowsRead,
        despesasAntes: before,
        despesasDepois: after,
        mudariamChave: wouldChangeKey,
        mudariamChaveCompartilhada: wouldChangeSharedKey,
        mudariamFixo: wouldChangeFixed,
        lotes: batches,
        linhasGravadas: rowsWritten,
        ms,
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
