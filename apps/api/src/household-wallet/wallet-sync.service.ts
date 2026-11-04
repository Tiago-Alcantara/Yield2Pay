import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ExpenseCategory,
  WalletNetwork,
  WalletSyncStatus,
} from '@yield2pay/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  classifyOperation,
  feeMovement,
  isPricedAsset,
  needsEffects,
  type HorizonOperation,
  type MovementDraft,
  type WalletRef,
} from './classify-operation';
import { GatewayRateLimitedError } from './wallet.errors';
import { WalletGateway } from './wallet-gateway';
import {
  lockWallet,
  walletFeeMerchant,
  walletFitPrefix,
  walletMerchant,
} from './wallet-lines';
import { valueInCents } from './wallet-money';
import {
  priceKey,
  WalletPricesService,
  type PriceRequest,
} from './wallet-prices.service';

const PAGE_SIZE = 200;
/** Teto de operações por sync, e da importação inicial. */
export const MAX_OPERATIONS_PER_SYNC = 1000;
export const INITIAL_IMPORT_DAYS = 90;
export const MIN_SYNC_INTERVAL_MS = 60_000;
const DAY_MS = 86_400_000;
const WRITE_TX = { maxWait: 10_000, timeout: 30_000 };
const MAX_REPRICE_ROWS = 200;
/** Categoria "Outros" da tela. */
const WALLET_EXPENSE_CATEGORY: ExpenseCategory = 'shopping';

type WalletRow = {
  id: string;
  householdId: string;
  addedByCompanyId: string;
  network: string;
  accountId: string;
  muxedId: string | null;
  label: string;
  cursor: string | null;
  syncStatus: string;
  syncNotBefore: Date | null;
};

export type WalletSyncOutcome = {
  id: string;
  syncStatus: WalletSyncStatus;
  retryAfterSeconds: number | null;
  inserted: number;
};

function refOf(wallet: WalletRow): WalletRef {
  return {
    network: wallet.network as WalletNetwork,
    accountId: wallet.accountId,
    muxedId: wallet.muxedId,
  };
}

function isValued(draft: {
  movementClass: string;
  asset: string | null;
  quantity: string | null;
}): boolean {
  return (
    (draft.movementClass === 'expense' || draft.movementClass === 'income') &&
    isPricedAsset(draft.asset) &&
    draft.quantity != null
  );
}

@Injectable()
export class WalletSyncService {
  private readonly logger = new Logger(WalletSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: WalletGateway,
    private readonly prices: WalletPricesService,
  ) {}

  /**
   * Um sync curto, sob demanda. Nenhuma falha de rede sobe: vira syncStatus
   * 'updating' e o próximo pedido continua do cursor salvo. A transação fica só
   * na escrita, nunca aberta enquanto espera o Horizon.
   */
  async syncWallet(
    walletId: string,
    deadline: number = Number.POSITIVE_INFINITY,
  ): Promise<WalletSyncOutcome | null> {
    const claim = await this.claim(walletId);
    if (!claim) return null;
    const { wallet, claimed } = claim;
    if (!claimed) {
      return {
        id: wallet.id,
        syncStatus: wallet.syncStatus as WalletSyncStatus,
        retryAfterSeconds: secondsUntil(wallet.syncNotBefore),
        inserted: 0,
      };
    }
    let inserted = 0;
    try {
      const run = await this.importOperations(wallet, deadline);
      inserted = run.inserted;
      inserted += await this.repriceMovements(wallet);
      if (run.caughtUp) {
        await this.prisma.householdWallet.updateMany({
          where: { id: wallet.id },
          data: { syncStatus: 'ok', lastSyncedAt: new Date() },
        });
        return {
          id: wallet.id,
          syncStatus: 'ok',
          retryAfterSeconds: null,
          inserted,
        };
      }
      return {
        id: wallet.id,
        syncStatus: 'updating',
        retryAfterSeconds: Math.ceil(MIN_SYNC_INTERVAL_MS / 1000),
        inserted,
      };
    } catch (error) {
      const retryAfterSeconds = await this.postpone(wallet.id, error);
      return {
        id: wallet.id,
        syncStatus: 'updating',
        retryAfterSeconds,
        inserted,
      };
    }
  }

  /** Respeita o intervalo mínimo. Dois pedidos juntos: só o primeiro chama o Horizon. */
  private async claim(walletId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockWallet(tx, walletId);
      const wallet = await tx.householdWallet.findUnique({
        where: { id: walletId },
      });
      if (!wallet) return null;
      const now = new Date();
      if (wallet.syncNotBefore && wallet.syncNotBefore > now) {
        return { wallet, claimed: false };
      }
      const updated = await tx.householdWallet.update({
        where: { id: wallet.id },
        data: {
          syncStatus: 'updating',
          syncNotBefore: new Date(now.getTime() + MIN_SYNC_INTERVAL_MS),
        },
      });
      return { wallet: updated, claimed: true };
    }, WRITE_TX);
  }

  private async postpone(walletId: string, error: unknown): Promise<number> {
    const minimum = Math.ceil(MIN_SYNC_INTERVAL_MS / 1000);
    const retryAfter =
      error instanceof GatewayRateLimitedError
        ? Math.max(error.retryAfterSeconds ?? minimum, minimum)
        : minimum;
    this.logger.warn(
      `Sync da carteira ${walletId} adiado: ${(error as Error).name}`,
    );
    await this.prisma.householdWallet.updateMany({
      where: { id: walletId },
      data: {
        syncStatus: 'updating',
        syncNotBefore: new Date(Date.now() + retryAfter * 1000),
      },
    });
    return retryAfter;
  }

  private async importOperations(wallet: WalletRow, deadline: number) {
    const ref = refOf(wallet);
    let savedCursor = wallet.cursor;
    let fetchCursor = wallet.cursor;
    if (savedCursor == null) {
      const start = await this.initialCursor(wallet);
      if (start.importFrom == null) {
        // Nada dentro da janela: guarda a última operação e não anda de novo.
        if (start.newest != null) {
          await this.saveCursor(wallet, savedCursor, start.newest, []);
        }
        return { inserted: 0, caughtUp: true };
      }
      fetchCursor = start.importFrom;
    }
    let inserted = 0;
    let seen = 0;
    for (;;) {
      const operations = await this.gateway.operations(
        ref.network,
        wallet.accountId,
        { cursor: fetchCursor, order: 'asc', limit: PAGE_SIZE },
      );
      const last = operations[operations.length - 1];
      if (!last) return { inserted, caughtUp: true };
      const drafts = await this.draftsOf(operations, ref);
      const saved = await this.saveCursor(
        wallet,
        savedCursor,
        last.paging_token,
        await this.priced(drafts),
      );
      // Outro sync passou na frente, ou a carteira foi removida.
      if (saved == null) return { inserted, caughtUp: false };
      inserted += saved;
      savedCursor = last.paging_token;
      fetchCursor = last.paging_token;
      seen += operations.length;
      if (operations.length < PAGE_SIZE) return { inserted, caughtUp: true };
      if (seen >= MAX_OPERATIONS_PER_SYNC || Date.now() >= deadline) {
        return { inserted, caughtUp: false };
      }
    }
  }

  /**
   * De onde começar: as operações mais recentes, até 90 dias ou 1000 operações. Anda
   * de trás para a frente só para achar o ponto; a importação em si segue em ordem.
   */
  private async initialCursor(wallet: WalletRow) {
    const cutoff = Date.now() - INITIAL_IMPORT_DAYS * DAY_MS;
    let cursor: string | null = null;
    let newest: string | null = null;
    let oldestInWindow: string | null = null;
    let count = 0;
    for (;;) {
      const page = await this.gateway.operations(
        wallet.network as WalletNetwork,
        wallet.accountId,
        { cursor, order: 'desc', limit: PAGE_SIZE },
      );
      for (const op of page) {
        newest ??= op.paging_token;
        if (Date.parse(op.created_at) < cutoff) {
          return { newest, importFrom: beforeToken(oldestInWindow) };
        }
        oldestInWindow = op.paging_token;
        count += 1;
        if (count >= MAX_OPERATIONS_PER_SYNC) {
          return { newest, importFrom: beforeToken(oldestInWindow) };
        }
      }
      const last = page[page.length - 1];
      if (!last || page.length < PAGE_SIZE) {
        return { newest, importFrom: beforeToken(oldestInWindow) };
      }
      cursor = last.paging_token;
    }
  }

  private async draftsOf(operations: HorizonOperation[], ref: WalletRef) {
    const drafts: MovementDraft[] = [];
    for (const op of operations) {
      const effects = needsEffects(op)
        ? await this.gateway.effects(ref.network, op.id)
        : [];
      const movement = classifyOperation(op, ref, effects);
      if (movement) drafts.push(movement);
      const fee = feeMovement(op, ref);
      if (fee) drafts.push(fee);
    }
    return drafts;
  }

  private async priced(drafts: MovementDraft[]) {
    const requests: PriceRequest[] = drafts.filter(isValued).map((draft) => ({
      asset: draft.asset as 'XLM' | 'USDC',
      day: draft.occurredOn,
    }));
    const prices = await this.prices.prices(requests);
    return drafts.map((draft) => {
      if (!isValued(draft)) return { ...draft, valueCents: null };
      const price = prices.get(
        priceKey(draft.asset as string, draft.occurredOn),
      );
      return {
        ...draft,
        valueCents: price
          ? valueInCents(draft.quantity as string, price)
          : null,
      };
    });
  }

  /**
   * Grava movimentos, linhas e cursor na mesma transação. Nulo: o cursor no banco
   * não é mais o esperado, e nada foi gravado.
   */
  private async saveCursor(
    wallet: WalletRow,
    expected: string | null,
    next: string,
    rows: (MovementDraft & { valueCents: number | null })[],
  ): Promise<number | null> {
    return this.prisma.$transaction(async (tx) => {
      await lockWallet(tx, wallet.id);
      const current = await tx.householdWallet.findUnique({
        where: { id: wallet.id },
        select: { cursor: true },
      });
      if (!current || current.cursor !== expected) return null;
      const fitIds = await this.writeExpenses(tx, wallet, rows);
      const created = await tx.walletMovement.createMany({
        data: rows.map((row) => ({
          walletId: wallet.id,
          opId: row.opId,
          txHash: row.txHash,
          occurredOn: new Date(`${row.occurredOn}T00:00:00.000Z`),
          opType: row.opType,
          direction: row.direction,
          asset: row.asset,
          quantity: row.quantity,
          feeStroops: row.feeStroops == null ? null : BigInt(row.feeStroops),
          movementClass: row.movementClass,
          valueCents: row.valueCents,
          expenseId: fitIds.get(fitIdOf(wallet.id, row.opId)) ?? null,
        })),
        skipDuplicates: true,
      });
      await tx.householdWallet.update({
        where: { id: wallet.id },
        data: { cursor: next },
      });
      return created.count;
    }, WRITE_TX);
  }

  /** Cria as linhas com valor de pelo menos um centavo. Devolve fitId → id. */
  private async writeExpenses(
    tx: Prisma.TransactionClient,
    wallet: WalletRow,
    rows: (MovementDraft & { valueCents: number | null })[],
  ) {
    const lines = rows.filter((row) => (row.valueCents ?? 0) > 0);
    const ids = new Map<string, string>();
    if (lines.length === 0) return ids;
    await tx.expense.createMany({
      data: lines.map((row) => expenseData(wallet, row)),
      skipDuplicates: true,
    });
    const created = await tx.expense.findMany({
      where: {
        householdId: wallet.householdId,
        fitId: { in: lines.map((row) => fitIdOf(wallet.id, row.opId)) },
      },
      select: { id: true, fitId: true },
    });
    for (const row of created) {
      if (row.fitId) ids.set(row.fitId, row.id);
    }
    return ids;
  }

  /** O que ficou sem preço por falha de fonte ganha valor quando o preço aparece. */
  private async repriceMovements(wallet: WalletRow): Promise<number> {
    const pending = await this.prisma.walletMovement.findMany({
      where: {
        walletId: wallet.id,
        valueCents: null,
        movementClass: { in: ['expense', 'income'] },
        asset: { in: ['XLM', 'USDC'] },
        quantity: { not: null },
      },
      orderBy: { occurredOn: 'asc' },
      take: MAX_REPRICE_ROWS,
    });
    if (pending.length === 0) return 0;
    const rows = await this.priced(
      pending.map((row) => ({
        opId: row.opId,
        txHash: row.txHash,
        occurredOn: row.occurredOn.toISOString().slice(0, 10),
        opType: row.opType,
        direction: row.direction as MovementDraft['direction'],
        asset: row.asset,
        quantity: row.quantity?.toFixed(7) ?? null,
        feeStroops: row.feeStroops?.toString() ?? null,
        movementClass: row.movementClass as MovementDraft['movementClass'],
      })),
    );
    const ready = rows.filter((row) => row.valueCents != null);
    if (ready.length === 0) return 0;
    await this.prisma.$transaction(async (tx) => {
      await lockWallet(tx, wallet.id);
      const stillThere = await tx.householdWallet.findUnique({
        where: { id: wallet.id },
        select: { id: true },
      });
      if (!stillThere) return;
      const fitIds = await this.writeExpenses(tx, wallet, ready);
      for (const row of ready) {
        await tx.walletMovement.updateMany({
          where: { walletId: wallet.id, opId: row.opId, valueCents: null },
          data: {
            valueCents: row.valueCents,
            expenseId: fitIds.get(fitIdOf(wallet.id, row.opId)) ?? null,
          },
        });
      }
    }, WRITE_TX);
    return ready.length;
  }
}

function fitIdOf(walletId: string, opId: string): string {
  return `${walletFitPrefix(walletId)}${opId}`;
}

function expenseData(
  wallet: WalletRow,
  row: MovementDraft & { valueCents: number | null },
) {
  const isIncome = row.movementClass === 'income';
  const fitId = fitIdOf(wallet.id, row.opId);
  return {
    householdId: wallet.householdId,
    addedByCompanyId: wallet.addedByCompanyId,
    spentOn: new Date(`${row.occurredOn}T00:00:00.000Z`),
    merchant:
      row.opType === 'fee'
        ? walletFeeMerchant(wallet.label)
        : walletMerchant(wallet.label),
    kind: isIncome ? 'income' : 'expense',
    category: isIncome ? null : WALLET_EXPENSE_CATEGORY,
    // Chave própria: a linha da carteira não entra na regra de gasto fixo.
    fixed: false,
    fixedManual: false,
    merchantKey: fitId,
    sharedMerchantKey: fitId,
    amountCents: row.valueCents as number,
    fitId,
    source: 'wallet',
  };
}

/** O cursor do Horizon é exclusivo: um antes do token inclui a própria operação. */
function beforeToken(token: string | null): string | null {
  if (token == null) return null;
  const previous = BigInt(token) - 1n;
  return (previous < 0n ? 0n : previous).toString();
}

function secondsUntil(at: Date | null): number | null {
  if (!at) return null;
  return Math.max(0, Math.ceil((at.getTime() - Date.now()) / 1000));
}
