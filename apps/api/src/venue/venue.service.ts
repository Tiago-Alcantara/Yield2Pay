import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  assertCanUseChain,
  defaultAccountChains,
  defaultVenueIdForChain,
  selectChain,
  unlockChain,
  type AccountChains,
  type ChainId,
  type Money,
  type SignedTx,
  type VenueId,
  type VenuePlugin,
  type VenueRegistry,
} from '@yield2pay/venue-core';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { LedgerService } from '../ledger/ledger.service';
import { parseBaseUnits } from '../common/parse-money';
import { VENUE_REGISTRY } from './venue.tokens';
import { Inject } from '@nestjs/common';

const MAX_DEPOSIT_BASE_UNITS = 100_000_000_000n;

function asVenueId(chain: string, protocol: string): VenueId {
  const id = `${chain}:${protocol}`;
  if (id !== 'stellar:blend' && id !== 'solana:kamino') {
    throw new NotFoundException(`venue_unknown:${id}`);
  }
  return id;
}

function asChainId(raw: string): ChainId {
  if (raw !== 'stellar' && raw !== 'solana') {
    throw new BadRequestException(`unknown_chain:${raw}`);
  }
  return raw;
}

function moneyFor(plugin: VenuePlugin, amount: bigint): Money {
  return {
    amount,
    decimals: plugin.chainId === 'stellar' ? 7 : 6,
    asset: 'USDC',
    chainId: plugin.chainId,
  };
}

function mapChainError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith('chain_locked:') || msg.startsWith('chain_not_selected:')) {
    throw new ForbiddenException(msg);
  }
  throw e;
}

@Injectable()
export class VenueService {
  constructor(
    @Inject(VENUE_REGISTRY) private readonly registry: VenueRegistry,
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly ledger: LedgerService,
  ) {}

  list() {
    return this.registry.list().map((p) => ({
      id: p.id,
      chainId: p.chainId,
      protocol: p.protocol,
      privyChainType: p.privyChainType,
      mode: p.mode,
      capabilities: p.capabilities,
    }));
  }

  async getAccountChains(companyId: string): Promise<AccountChains> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });
    const selected = asChainId(company.selectedChain);
    const unlocked = company.unlockedChains.map(asChainId);
    if (unlocked.length === 0) return defaultAccountChains();
    return { selectedChain: selected, unlockedChains: unlocked };
  }

  async unlock(companyId: string, chainId: ChainId): Promise<AccountChains> {
    const current = await this.getAccountChains(companyId);
    const next = unlockChain(current, chainId);
    await this.persist(companyId, next);
    return next;
  }

  async select(companyId: string, chainId: ChainId): Promise<AccountChains> {
    const current = await this.getAccountChains(companyId);
    try {
      const next = selectChain(current, chainId);
      await this.persist(companyId, next);
      return next;
    } catch (e) {
      mapChainError(e);
    }
  }

  async buildDeposit(
    companyId: string,
    chain: string,
    protocol: string,
    amountRaw: string,
  ) {
    const amount = parseBaseUnits(amountRaw);
    if (amount > MAX_DEPOSIT_BASE_UNITS) {
      throw new BadRequestException('amount exceeds maximum deposit');
    }
    const plugin = await this.pluginForCompany(companyId, chain, protocol);
    const owner = await this.ownerAddress(companyId, plugin.chainId);
    return plugin.buildDeposit(owner, moneyFor(plugin, amount));
  }

  async buildWithdraw(
    companyId: string,
    chain: string,
    protocol: string,
    amountRaw: string,
  ) {
    const amount = parseBaseUnits(amountRaw);
    const plugin = await this.pluginForCompany(companyId, chain, protocol);
    const owner = await this.ownerAddress(companyId, plugin.chainId);
    return plugin.buildWithdraw(owner, moneyFor(plugin, amount));
  }

  async submitDeposit(
    companyId: string,
    chain: string,
    protocol: string,
    body: {
      amount: string;
      xdr?: string;
      hash?: string;
      signatureHex?: string;
      stellarAddress?: string;
      address?: string;
      signedTransactionBase64?: string;
    },
  ) {
    const amount = parseBaseUnits(body.amount);
    const plugin = await this.pluginForCompany(companyId, chain, protocol);
    const owner = await this.ownerAddress(companyId, plugin.chainId);
    const signed = this.toSignedTx(plugin, owner, body);
    const { txRef } = await plugin.submit(signed);
    await this.ledger.recordDeposit(companyId, amount, txRef);
    return { txHash: txRef, txRef };
  }

  async submitWithdraw(
    companyId: string,
    chain: string,
    protocol: string,
    body: {
      amount: string;
      xdr?: string;
      signatureHex?: string;
      stellarAddress?: string;
      address?: string;
      signedTransactionBase64?: string;
    },
  ) {
    const amount = parseBaseUnits(body.amount);
    const plugin = await this.pluginForCompany(companyId, chain, protocol);
    const owner = await this.ownerAddress(companyId, plugin.chainId);
    const signed = this.toSignedTx(plugin, owner, body);
    const { txRef } = await plugin.submit(signed);
    await this.ledger.recordWithdraw(companyId, amount, txRef);
    return { txHash: txRef, txRef };
  }

  private async persist(companyId: string, next: AccountChains) {
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        selectedChain: next.selectedChain,
        unlockedChains: next.unlockedChains,
      },
    });
  }

  private async pluginForCompany(
    companyId: string,
    chain: string,
    protocol: string,
  ): Promise<VenuePlugin> {
    const venueId = asVenueId(chain, protocol);
    const plugin = this.registry.get(venueId);
    const account = await this.getAccountChains(companyId);
    try {
      assertCanUseChain(account, plugin.chainId);
    } catch (e) {
      mapChainError(e);
    }
    if (defaultVenueIdForChain(plugin.chainId) !== plugin.id) {
      throw new BadRequestException('venue_not_default_for_chain');
    }
    return plugin;
  }

  private async ownerAddress(
    companyId: string,
    chainId: ChainId,
  ): Promise<string> {
    if (chainId === 'stellar') return this.wallet.getAddress(companyId);
    const solana = await this.wallet.getSolanaAddress(companyId);
    if (!solana) {
      throw new BadRequestException('solana wallet not registered');
    }
    return solana;
  }

  private toSignedTx(
    plugin: VenuePlugin,
    owner: string,
    body: {
      xdr?: string;
      signatureHex?: string;
      stellarAddress?: string;
      address?: string;
      signedTransactionBase64?: string;
    },
  ): SignedTx {
    if (plugin.chainId === 'stellar') {
      const address = body.address ?? body.stellarAddress;
      if (!body.xdr || !body.signatureHex || !address) {
        throw new BadRequestException('stellar signed tx fields required');
      }
      if (address !== owner) {
        throw new ForbiddenException(
          'stellar address does not match registered wallet',
        );
      }
      return {
        chain: 'stellar',
        xdr: body.xdr,
        signatureHex: body.signatureHex,
        address,
      };
    }
    if (!body.signedTransactionBase64) {
      throw new BadRequestException('solana signed tx required');
    }
    return {
      chain: 'solana',
      signedTransactionBase64: body.signedTransactionBase64,
    };
  }
}
