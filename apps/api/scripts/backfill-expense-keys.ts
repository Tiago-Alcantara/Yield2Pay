/**
 * Simula o preenchimento de merchant_key, shared_merchant_key e fixed.
 * Só lê o banco nesta máquina. Não há caminho de escrita: --apply encerra o processo.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  assertLocalDatabaseUrl,
  assertSimulationOnly,
  previewHouseholdBackfill,
} from '../src/expenses/backfill-preview';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  try {
    assertSimulationOnly(process.argv.slice(2));
  } catch (error) {
    fail(error instanceof Error ? error.message : 'recusado');
  }
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl) fail('recusado: DATABASE_URL ausente');
  try {
    assertLocalDatabaseUrl(databaseUrl);
  } catch (error) {
    fail(error instanceof Error ? error.message : 'recusado');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const before = await prisma.expense.count();
  const households = await prisma.household.findMany({
    select: { id: true },
  });
  let rowsRead = 0;
  let wouldChangeKey = 0;
  let wouldChangeSharedKey = 0;
  let wouldChangeFixed = 0;
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
        merchantKey: true,
        sharedMerchantKey: true,
      },
    });
    rowsRead += rows.length;
    const changes = previewHouseholdBackfill(
      rows.map((row) => ({
        id: row.id,
        merchant: row.merchant,
        spentOn: row.spentOn.toISOString().slice(0, 10),
        amountCents: row.amountCents,
        category: row.category,
        fixed: row.fixed,
        merchantKey: row.merchantKey,
        sharedMerchantKey: row.sharedMerchantKey,
      })),
    );
    for (const change of changes) {
      if (change.merchantKey !== undefined) wouldChangeKey += 1;
      if (change.sharedMerchantKey !== undefined) wouldChangeSharedKey += 1;
      if (change.fixed !== undefined) wouldChangeFixed += 1;
    }
  }
  const after = await prisma.expense.count();
  await prisma.$disconnect();
  if (before !== after) fail('a simulação alterou a contagem de despesas');
  console.log('Nada foi gravado.');
  console.log(
    JSON.stringify(
      {
        modo: 'simulacao',
        gravou: false,
        casas: households.length,
        despesasLidas: rowsRead,
        despesasAntes: before,
        despesasDepois: after,
        mudariamChave: wouldChangeKey,
        mudariamChaveCompartilhada: wouldChangeSharedKey,
        mudariamFixo: wouldChangeFixed,
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
