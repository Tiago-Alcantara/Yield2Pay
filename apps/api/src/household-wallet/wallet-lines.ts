import type { Prisma } from '@prisma/client';

export function walletMerchant(label: string): string {
  return `Carteira ${label}`;
}

export function walletFeeMerchant(label: string): string {
  return `Taxa da rede · Carteira ${label}`;
}

/** fitId da linha em expenses. O prefixo acha as linhas da carteira ao remover. */
export function walletFitPrefix(walletId: string): string {
  return `w:${walletId}:`;
}

export async function lockWallet(
  tx: Prisma.TransactionClient,
  walletId: string,
) {
  // O FROM obriga o Postgres a executar o lock, como em lockExpenseGroups.
  await tx.$queryRaw`
    SELECT 1 AS locked
    FROM (
      SELECT pg_advisory_xact_lock(hashtext('household_wallet'), hashtext(${walletId})) AS acquired
    ) AS lock_row
  `;
}
