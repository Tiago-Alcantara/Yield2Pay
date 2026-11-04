import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  HouseholdWalletView,
  WalletMovementClass,
  WalletMovementPage,
  WalletMovementView,
  WalletNetwork,
  WalletSyncResult,
  WalletSyncStatus,
} from '@yield2pay/shared';
import type { ActiveMembership } from '../auth/authenticated-request';
import { PrismaService } from '../prisma/prisma.service';
import {
  containsStellarKey,
  maskWalletAddress,
  parseWalletAddress,
} from './wallet-address';
import { WalletGateway } from './wallet-gateway';
import {
  walletFeeMerchant,
  walletFitPrefix,
  walletMerchant,
} from './wallet-lines';
import { deleteWalletsWithLines } from './wallet-removal';
import { WalletSyncService } from './wallet-sync.service';
import {
  WalletAccountNotFoundError,
  WalletDuplicateError,
  WalletForbiddenError,
  WalletInvalidError,
  WalletNotFoundError,
  WalletUpstreamError,
} from './wallet.errors';

const NETWORKS: WalletNetwork[] = ['public', 'testnet'];
const MAX_LABEL = 40;
const MAX_MOVEMENTS = 1000;
/** Depois disto o pedido responde e o resto continua no próximo. */
const SYNC_BUDGET_MS = 45_000;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function readLabel(raw: unknown): string {
  if (typeof raw !== 'string') throw new WalletInvalidError();
  const label = raw.trim();
  if (!label || label.length > MAX_LABEL || containsStellarKey(label)) {
    throw new WalletInvalidError();
  }
  return label;
}

function readNetwork(raw: unknown): WalletNetwork {
  if (raw === undefined) return 'public';
  if (!NETWORKS.includes(raw as WalletNetwork)) throw new WalletInvalidError();
  return raw as WalletNetwork;
}

function dayRange(query: { month?: string; from?: string; to?: string }) {
  if (query.from || query.to) {
    const { from, to } = query;
    if (!from || !to || !DAY.test(from) || !DAY.test(to)) {
      throw new WalletInvalidError();
    }
    const start = Date.parse(`${from}T00:00:00.000Z`);
    const end = Date.parse(`${to}T00:00:00.000Z`);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new WalletInvalidError();
    }
    return {
      gte: new Date(Math.min(start, end)),
      lt: new Date(Math.max(start, end) + 86_400_000),
    };
  }
  if (!query.month || !MONTH.test(query.month)) throw new WalletInvalidError();
  const [year, month] = query.month.split('-').map(Number);
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

/** Código do ativo. Outro emissor sai com o emissor mascarado. */
function assetLabel(asset: string | null): string | null {
  if (!asset) return null;
  const [code, issuer] = asset.split(':');
  if (!issuer) return code ?? null;
  return `${code} (${issuer.slice(0, 1)}...${issuer.slice(-4)})`;
}

/** 0.5000000 vira 0.5. */
function trimQuantity(quantity: Prisma.Decimal | null): string | null {
  if (!quantity) return null;
  const text = quantity.toFixed(7);
  return text.replace(/\.?0+$/, '');
}

@Injectable()
export class HouseholdWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: WalletGateway,
    private readonly sync: WalletSyncService,
  ) {}

  async list(membership: ActiveMembership): Promise<HouseholdWalletView[]> {
    const wallets = await this.prisma.householdWallet.findMany({
      where: { householdId: membership.householdId },
      orderBy: { createdAt: 'asc' },
    });
    return wallets.map((wallet) => toView(wallet, membership.companyId));
  }

  async add(
    membership: ActiveMembership,
    body: { address?: unknown; label?: unknown; network?: unknown },
  ): Promise<HouseholdWalletView> {
    const { accountId, muxedId } = parseWalletAddress(body?.address);
    const label = readLabel(body?.label);
    const network = readNetwork(body?.network);
    let exists: boolean;
    try {
      exists = await this.gateway.accountExists(network, accountId);
    } catch {
      throw new WalletUpstreamError();
    }
    if (!exists) throw new WalletAccountNotFoundError();
    try {
      const wallet = await this.prisma.householdWallet.create({
        data: {
          householdId: membership.householdId,
          addedByCompanyId: membership.companyId,
          network,
          accountId,
          muxedId,
          label,
        },
      });
      return toView(wallet, membership.companyId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new WalletDuplicateError();
      }
      // O erro do Prisma pode citar os valores da linha.
      throw new Error('Não foi possível salvar a carteira.');
    }
  }

  async rename(
    membership: ActiveMembership,
    id: string,
    body: { label?: unknown },
  ): Promise<HouseholdWalletView> {
    const label = readLabel(body?.label);
    const wallet = await this.ownedWallet(membership, id);
    const prefix = walletFitPrefix(wallet.id);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.expense.updateMany({
        where: {
          householdId: wallet.householdId,
          source: 'wallet',
          fitId: { startsWith: `${prefix}fee:` },
        },
        data: { merchant: walletFeeMerchant(label) },
      });
      await tx.expense.updateMany({
        where: {
          householdId: wallet.householdId,
          source: 'wallet',
          fitId: { startsWith: prefix },
          NOT: { fitId: { startsWith: `${prefix}fee:` } },
        },
        data: { merchant: walletMerchant(label) },
      });
      return tx.householdWallet.update({
        where: { id: wallet.id },
        data: { label },
      });
    });
    return toView(updated, membership.companyId);
  }

  async remove(membership: ActiveMembership, id: string): Promise<void> {
    const wallet = await this.ownedWallet(membership, id);
    await this.prisma.$transaction((tx) =>
      deleteWalletsWithLines(tx, [wallet]),
    );
  }

  async syncAll(membership: ActiveMembership): Promise<WalletSyncResult> {
    const wallets = await this.prisma.householdWallet.findMany({
      where: { householdId: membership.householdId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, syncStatus: true },
    });
    const deadline = Date.now() + SYNC_BUDGET_MS;
    const result: WalletSyncResult = { wallets: [], changed: false };
    for (const wallet of wallets) {
      if (Date.now() >= deadline) {
        result.wallets.push({
          id: wallet.id,
          syncStatus: wallet.syncStatus as WalletSyncStatus,
          retryAfterSeconds: 60,
        });
        continue;
      }
      const outcome = await this.sync.syncWallet(wallet.id, deadline);
      if (!outcome) continue;
      result.wallets.push({
        id: outcome.id,
        syncStatus: outcome.syncStatus,
        retryAfterSeconds: outcome.retryAfterSeconds,
      });
      if (outcome.inserted > 0) result.changed = true;
    }
    return result;
  }

  async movements(
    membership: ActiveMembership,
    query: { month?: string; from?: string; to?: string },
  ): Promise<WalletMovementPage> {
    const occurredOn = dayRange(query);
    const rows = await this.prisma.walletMovement.findMany({
      where: {
        occurredOn,
        wallet: { householdId: membership.householdId },
        // Taxa sem linha em expenses (menos de um centavo) não polui a lista.
        NOT: { opType: 'fee', expenseId: null },
      },
      include: {
        wallet: { select: { label: true, addedByCompanyId: true } },
        expense: { select: { excludedFromTotals: true } },
      },
      orderBy: [{ occurredOn: 'desc' }, { opId: 'desc' }],
      take: MAX_MOVEMENTS + 1,
    });
    const page = rows.slice(0, MAX_MOVEMENTS);
    return {
      items: page.map((row): WalletMovementView => {
        const quantity = trimQuantity(row.quantity);
        return {
          id: row.id,
          date: row.occurredOn.toISOString().slice(0, 10),
          walletId: row.walletId,
          origin: walletMerchant(row.wallet.label),
          opType: row.opType,
          direction: row.direction as WalletMovementView['direction'],
          asset: assetLabel(row.asset),
          quantity,
          valueCents: row.valueCents,
          movementClass: row.movementClass as WalletMovementClass,
          ownTransfer: row.expense?.excludedFromTotals === true,
          canMarkTransfer:
            row.expenseId != null &&
            row.wallet.addedByCompanyId === membership.companyId,
        };
      }),
      truncated: rows.length > MAX_MOVEMENTS,
    };
  }

  /** Grava na linha de expenses. Desmarcar devolve a linha aos totais. */
  async markOwnTransfer(
    membership: ActiveMembership,
    movementId: string,
    body: { ownTransfer?: unknown },
  ): Promise<void> {
    if (typeof body?.ownTransfer !== 'boolean') throw new WalletInvalidError();
    const movement = await this.prisma.walletMovement.findFirst({
      where: {
        id: movementId,
        wallet: { householdId: membership.householdId },
      },
      include: { wallet: { select: { addedByCompanyId: true } } },
    });
    if (!movement) throw new WalletNotFoundError();
    if (movement.wallet.addedByCompanyId !== membership.companyId) {
      throw new WalletForbiddenError();
    }
    if (!movement.expenseId) throw new WalletInvalidError();
    await this.prisma.expense.updateMany({
      where: {
        id: movement.expenseId,
        householdId: membership.householdId,
        source: 'wallet',
      },
      data: { excludedFromTotals: body.ownTransfer },
    });
  }

  private async ownedWallet(membership: ActiveMembership, id: string) {
    const wallet = await this.prisma.householdWallet.findFirst({
      where: { id, householdId: membership.householdId },
    });
    if (!wallet) throw new WalletNotFoundError();
    if (wallet.addedByCompanyId !== membership.companyId) {
      throw new WalletForbiddenError();
    }
    return wallet;
  }
}

function toView(
  wallet: {
    id: string;
    label: string;
    network: string;
    accountId: string;
    muxedId: string | null;
    syncStatus: string;
    lastSyncedAt: Date | null;
    addedByCompanyId: string;
  },
  companyId: string,
): HouseholdWalletView {
  return {
    id: wallet.id,
    label: wallet.label,
    network: wallet.network as WalletNetwork,
    maskedAddress: maskWalletAddress(wallet.accountId, wallet.muxedId),
    syncStatus: wallet.syncStatus as WalletSyncStatus,
    lastSyncedAt: wallet.lastSyncedAt?.toISOString() ?? null,
    canManage: wallet.addedByCompanyId === companyId,
  };
}
