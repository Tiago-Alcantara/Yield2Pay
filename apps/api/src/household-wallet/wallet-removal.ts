import type { Prisma } from '@prisma/client';
import { lockWallet, walletFitPrefix } from './wallet-lines';

/**
 * Tira as carteiras: as linhas em expenses, e os movimentos pela cascata. O lock
 * espera um sync que esteja gravando: sem ele, a linha nova ficaria órfã.
 */
export async function deleteWalletsWithLines(
  tx: Prisma.TransactionClient,
  wallets: { id: string; householdId: string }[],
): Promise<void> {
  for (const wallet of wallets) {
    await lockWallet(tx, wallet.id);
    await tx.expense.deleteMany({
      where: {
        householdId: wallet.householdId,
        source: 'wallet',
        fitId: { startsWith: walletFitPrefix(wallet.id) },
      },
    });
    await tx.householdWallet.deleteMany({ where: { id: wallet.id } });
  }
}

/** Quem sai do grupo, ou apaga os dados, leva as carteiras que adicionou. */
export async function deleteWalletsAddedBy(
  tx: Prisma.TransactionClient,
  householdId: string,
  companyId: string,
): Promise<void> {
  const wallets = await tx.householdWallet.findMany({
    where: { householdId, addedByCompanyId: companyId },
    select: { id: true, householdId: true },
  });
  await deleteWalletsWithLines(tx, wallets);
}
