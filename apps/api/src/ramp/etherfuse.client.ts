import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';

export interface EfAsset {
  identifier: string;
  symbol: string;
  name: string;
}

export interface EfQuoteResult {
  quoteId: string;
  sourceAmount: string;
  targetAmount: string;
  feeBps: number;
  feeAmount: string;
  expiresAt: string;
}

export interface EfOrderResult {
  orderId: string;
  status: string;
  depositClabe?: string;
  depositBankName?: string;
  burnTransaction?: string;
  stellarClaimTransaction?: string;
  stellarClaimableBalanceId?: string;
  statusPage?: string;
}

export interface EfOrderStatus {
  orderId: string;
  status: string; // created | funded | completed | finalized | cancelled
  burnTransaction?: string;
  stellarClaimTransaction?: string;
  stellarClaimableBalanceId?: string;
  statusPage?: string;
}

export interface EfWallet {
  walletId: string;
  publicKey: string;
  kycStatus: string;
  claimedOwnership: boolean;
}

export interface EfBankAccount {
  bankAccountId: string;
  currency: string;
  compliant: boolean;
  status: string;
  deletedAt?: string | null;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ASSET: EfAsset = {
  identifier: 'USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  symbol: 'USDC',
  name: 'USD Coin (testnet)',
};

function mockOrderStatus(orderId: string, createdAt: number): EfOrderStatus {
  const age = Date.now() - createdAt;
  let status = 'created';
  if (age > 3000) status = 'funded';
  if (age > 6000) status = 'completed';
  return { orderId, status };
}

@Injectable()
export class EtherfuseClient {
  private readonly logger = new Logger(EtherfuseClient.name);
  private readonly isMock: boolean;
  // Tracks mock order creation times for simulated progression.
  private readonly mockOrders = new Map<string, number>();

  constructor(@Inject(APP_CONFIG) private readonly config: Env) {
    this.isMock = !config.etherfuseApiKey;
    if (this.isMock) {
      this.logger.warn('ETHERFUSE_API_KEY not set — using mock mode');
    }
  }

  /**
   * O org/customerId é o 3º segmento da API key (formato
   * `api_sand:<keyId>:<orgId>`). Usado como customerId nos quotes — o org é
   * o próprio "customer" no modelo sandbox. Override via ETHERFUSE_CUSTOMER_ID.
   */
  getCustomerId(): string {
    if (this.config.etherfuseCustomerId) return this.config.etherfuseCustomerId;
    if (this.isMock) return 'mock-customer';
    const parts = (this.config.etherfuseApiKey ?? '').split(':');
    const orgId = parts[parts.length - 1];
    if (!orgId) {
      throw new Error(
        'Cannot derive Etherfuse customerId from API key; set ETHERFUSE_CUSTOMER_ID',
      );
    }
    return orgId;
  }

  get mock(): boolean {
    return this.isMock;
  }

  /** Moeda fiat configurada (BRL/Pix por padrão). */
  get fiatCurrency(): 'BRL' | 'MXN' {
    return this.config.etherfuseFiatCurrency;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.config.etherfuseBaseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.config.etherfuseApiKey!,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const raw = await res.text().catch(() => '');
    if (!res.ok) {
      // Log completo pro dev; mensagem limpa pro cliente.
      this.logger.warn(`Etherfuse ${method} ${path} → ${res.status}: ${raw}`);
      // 4xx da Etherfuse = input inválido / limite de sandbox → repassa o status.
      // 5xx ou desconhecido = falha upstream → 502.
      const status =
        res.status >= 400 && res.status < 500
          ? res.status
          : HttpStatus.BAD_GATEWAY;
      throw new HttpException(this.extractError(raw), status);
    }
    // Alguns endpoints (ex.: fiat_received) retornam 200 com corpo vazio.
    if (!raw) return undefined as T;
    return JSON.parse(raw) as T;
  }

  /** Extrai a mensagem legível do corpo de erro da Etherfuse (JSON `{message}` ou cru). */
  private extractError(raw: string): string {
    try {
      const body = JSON.parse(raw) as { message?: unknown };
      if (typeof body.message === 'string' && body.message) return body.message;
    } catch {
      // corpo não-JSON — cai pro cru abaixo.
    }
    return raw || 'Etherfuse request failed';
  }

  // ── Customer onboarding ───────────────────────────────────────────────────

  async createOnboardingUrl(params: {
    customerId: string;
    bankAccountId: string;
    walletPublicKey: string;
    email: string;
    displayName: string;
  }): Promise<string> {
    if (this.isMock) {
      return `https://sandbox.etherfuse.com/onboarding?mock=1&customerId=${params.customerId}`;
    }
    const res = await this.request<{ presigned_url: string }>(
      'POST',
      '/ramp/onboarding-url',
      {
        customerId: params.customerId,
        bankAccountId: params.bankAccountId,
        publicKey: params.walletPublicKey,
        blockchain: 'stellar',
        userInfo: { email: params.email, displayName: params.displayName },
      },
    );
    return res.presigned_url;
  }

  // ── Wallets ───────────────────────────────────────────────────────────────

  /**
   * Registra a wallet Stellar no org com claimOwnership=true. Com o KYB do org
   * aprovado, a wallet herda o status e vira `approved` automaticamente —
   * sem KYC/agreements por usuário. Idempotente.
   */
  async registerWallet(publicKey: string): Promise<EfWallet> {
    if (this.isMock) {
      return {
        walletId: 'mock-wallet',
        publicKey,
        kycStatus: 'approved',
        claimedOwnership: true,
      };
    }
    return this.request<EfWallet>('POST', '/ramp/wallet', {
      publicKey,
      blockchain: 'stellar',
      claimOwnership: true,
    });
  }

  // ── Bank accounts ─────────────────────────────────────────────────────────

  async listBankAccounts(): Promise<EfBankAccount[]> {
    if (this.isMock) {
      return [
        {
          bankAccountId: 'mock-bank',
          currency: this.fiatCurrency.toLowerCase(),
          compliant: true,
          status: 'active',
        },
      ];
    }
    const res = await this.request<{ items: EfBankAccount[] }>(
      'GET',
      '/ramp/bank-accounts',
    );
    return res.items ?? [];
  }

  /** Primeira conta compliant da moeda dada (default = fiat configurada), ativa e não deletada. */
  async findCompliantBank(currency?: string): Promise<EfBankAccount | null> {
    const target = (currency ?? this.fiatCurrency).toLowerCase();
    const accounts = await this.listBankAccounts();
    return (
      accounts.find(
        (a) =>
          a.currency?.toLowerCase() === target &&
          a.compliant &&
          a.status === 'active' &&
          !a.deletedAt,
      ) ?? null
    );
  }

  // ── Assets ────────────────────────────────────────────────────────────────

  // A API real exige currency + wallet (senão retorna 400).
  async listAssets(walletAddress: string, currency?: string): Promise<EfAsset[]> {
    if (this.isMock) return [MOCK_ASSET];
    const qs = new URLSearchParams({
      blockchain: 'stellar',
      currency: (currency ?? this.fiatCurrency).toLowerCase(),
      wallet: walletAddress,
    });
    const res = await this.request<{ assets: EfAsset[] }>(
      'GET',
      `/ramp/assets?${qs.toString()}`,
    );
    return res.assets ?? [];
  }

  // Seleciona o asset pelo símbolo (ex.: USDC), com fallback pro primeiro.
  async pickAsset(walletAddress: string, symbol: string): Promise<EfAsset> {
    const assets = await this.listAssets(walletAddress);
    const match = assets.find(
      (a) => a.symbol?.toUpperCase() === symbol.toUpperCase(),
    );
    if (match) return match;
    if (assets.length) return assets[0];
    throw new Error('no rampable assets on Stellar');
  }

  // ── Quote ─────────────────────────────────────────────────────────────────

  async createQuote(params: {
    customerId: string;
    type: 'onramp' | 'offramp';
    sourceAsset: string;
    targetAsset: string;
    sourceAmount: string;
    walletAddress?: string;
  }): Promise<EfQuoteResult> {
    if (this.isMock) {
      const quoteId = randomUUID();
      const rate = params.type === 'onramp' ? 0.055 : 18.2;
      const target = (parseFloat(params.sourceAmount) * rate).toFixed(2);
      return {
        quoteId,
        sourceAmount: params.sourceAmount,
        targetAmount: target,
        feeBps: 20,
        feeAmount: (parseFloat(params.sourceAmount) * 0.002).toFixed(2),
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      };
    }
    const quoteId = randomUUID();
    const body: Record<string, unknown> = {
      quoteId,
      customerId: params.customerId,
      blockchain: 'stellar',
      quoteAssets: {
        type: params.type,
        sourceAsset: params.sourceAsset,
        targetAsset: params.targetAsset,
      },
      sourceAmount: params.sourceAmount,
    };
    if (params.walletAddress) body.walletAddress = params.walletAddress;
    // Resposta real: { quoteId, sourceAmount, destinationAmount, feeBps, feeAmount, expiresAt, ... }
    const res = await this.request<{
      quoteId?: string;
      sourceAmount?: string;
      destinationAmount?: string;
      feeBps?: string | number;
      feeAmount?: string;
      expiresAt?: string;
    }>('POST', '/ramp/quote', body);
    return {
      quoteId: res.quoteId ?? quoteId,
      sourceAmount: res.sourceAmount ?? params.sourceAmount,
      targetAmount: res.destinationAmount ?? '0',
      feeBps: Number(res.feeBps ?? 0),
      feeAmount: res.feeAmount ?? '0',
      expiresAt: res.expiresAt ?? new Date(Date.now() + 120_000).toISOString(),
    };
  }

  // ── Order ─────────────────────────────────────────────────────────────────

  async createOrder(params: {
    orderId: string;
    quoteId: string;
    bankAccountId: string;
    publicKey: string;
  }): Promise<EfOrderResult> {
    if (this.isMock) {
      this.mockOrders.set(params.orderId, Date.now());
      return {
        orderId: params.orderId,
        status: 'created',
        depositClabe: '646180110400000009',
        depositBankName: 'Etherfuse MX (mock)',
        statusPage: `https://sandbox.etherfuse.com/ramp/order/${params.orderId}`,
      };
    }
    // Resposta real é aninhada: { onramp: {...} } ou { offramp: {...} }.
    // burnTransaction / status / statusPage só aparecem no GET /ramp/order.
    // A API exige publicKey (ou cryptoWalletId) pra resolver a wallet.
    const created = await this.request<{
      onramp?: {
        orderId: string;
        depositClabe?: string;
        depositBankName?: string;
        depositAccountHolder?: string;
      };
      offramp?: { orderId: string };
    }>('POST', '/ramp/order', {
      orderId: params.orderId,
      bankAccountId: params.bankAccountId,
      publicKey: params.publicKey,
      quoteId: params.quoteId,
    });

    const inner = created.onramp ?? created.offramp;
    const orderId = inner?.orderId ?? params.orderId;

    // Busca os detalhes completos (status, burnTransaction, statusPage).
    const full = await this.getOrder(orderId).catch(() => null);

    return {
      orderId,
      status: full?.status ?? 'created',
      depositClabe: created.onramp?.depositClabe,
      depositBankName: created.onramp?.depositBankName,
      burnTransaction: full?.burnTransaction,
      stellarClaimTransaction: full?.stellarClaimTransaction,
      stellarClaimableBalanceId: full?.stellarClaimableBalanceId,
      statusPage: full?.statusPage,
    };
  }

  // ── Sandbox simulation ────────────────────────────────────────────────────

  async simulateFiatReceived(orderId: string): Promise<void> {
    if (this.isMock) {
      // Advance mock clock so status becomes "funded" immediately.
      this.mockOrders.set(orderId, Date.now() - 10_000);
      return;
    }
    await this.request('POST', '/ramp/order/fiat_received', { orderId });
  }

  /**
   * Regenera as txs pré-montadas da order (claim/burn) com sequence fresca.
   * Usado quando a tx expira (`tx_too_late`) ou a sequence fica velha.
   */
  async regenerateTx(orderId: string): Promise<void> {
    if (this.isMock) return;
    await this.request('POST', `/ramp/order/${orderId}/regenerate_tx`, {});
  }

  // ── Order status ──────────────────────────────────────────────────────────

  async getOrder(orderId: string): Promise<EfOrderStatus> {
    if (this.isMock) {
      const createdAt = this.mockOrders.get(orderId) ?? Date.now() - 10_000;
      return mockOrderStatus(orderId, createdAt);
    }
    const res = await this.request<{
      orderId: string;
      status: string;
      burnTransaction?: string | null;
      stellarClaimTransaction?: string | null;
      stellarClaimableBalanceId?: string | null;
      statusPage?: string | null;
    }>('GET', `/ramp/order/${orderId}`);
    return {
      orderId: res.orderId,
      status: res.status,
      burnTransaction: res.burnTransaction ?? undefined,
      stellarClaimTransaction: res.stellarClaimTransaction ?? undefined,
      stellarClaimableBalanceId: res.stellarClaimableBalanceId ?? undefined,
      statusPage: res.statusPage ?? undefined,
    };
  }
}
