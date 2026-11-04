import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  Asset,
  Horizon,
  NetworkError,
  NotFoundError,
} from '@stellar/stellar-sdk';
import type { WalletNetwork } from '@yield2pay/shared';
import {
  USDC_CIRCLE_ISSUER,
  type HorizonEffect,
  type HorizonOperation,
} from './classify-operation';
import {
  GatewayNotFoundError,
  GatewayRateLimitedError,
  GatewayUnavailableError,
} from './wallet.errors';

const DAY_MS = 86_400_000;
const REQUEST_TIMEOUT_MS = 15_000;

/** Fontes públicas, sem chave e sem env. Os testes trocam pelo token abaixo. */
export const WALLET_GATEWAY_URLS = {
  public: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
  ptax: 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata',
};

export const WALLET_GATEWAY_URLS_TOKEN = 'WALLET_GATEWAY_URLS';

export type GatewayUrls = typeof WALLET_GATEWAY_URLS;

export type OperationsQuery = {
  cursor: string | null;
  order: 'asc' | 'desc';
  limit: number;
};

/**
 * Tudo o que sai para o Horizon e o BCB. O erro do SDK traz a URL, e a URL traz o
 * endereço: nenhum erro original passa daqui. O que sobe são os erros da
 * wallet.errors, com status e Retry-After, sem texto de fora.
 */
@Injectable()
export class WalletGateway {
  private readonly servers = new Map<WalletNetwork, Horizon.Server>();
  private readonly urls: GatewayUrls;

  constructor(
    @Optional() @Inject(WALLET_GATEWAY_URLS_TOKEN) urls?: GatewayUrls,
  ) {
    this.urls = urls ?? WALLET_GATEWAY_URLS;
  }

  async accountExists(
    network: WalletNetwork,
    accountId: string,
  ): Promise<boolean> {
    try {
      await this.guard(() =>
        this.server(network).accounts().accountId(accountId).call(),
      );
      return true;
    } catch (error) {
      if (error instanceof GatewayNotFoundError) return false;
      throw error;
    }
  }

  async operations(
    network: WalletNetwork,
    accountId: string,
    query: OperationsQuery,
  ): Promise<HorizonOperation[]> {
    const page = await this.guard(() => {
      const builder = this.server(network)
        .operations()
        .forAccount(accountId)
        .join('transactions')
        .order(query.order)
        .limit(query.limit);
      if (query.cursor) builder.cursor(query.cursor);
      return builder.call();
    });
    return page.records;
  }

  async effects(
    network: WalletNetwork,
    operationId: string,
  ): Promise<HorizonEffect[]> {
    const page = await this.guard(() =>
      this.server(network)
        .effects()
        .forOperation(operationId)
        .limit(200)
        .call(),
    );
    return page.records;
  }

  /** Média diária de XLM em USDC da Circle na mainnet, por dia UTC. */
  async xlmUsdcDailyAverages(
    firstDay: string,
    lastDay: string,
  ): Promise<Map<string, string>> {
    const start = Date.parse(`${firstDay}T00:00:00.000Z`);
    const end = Date.parse(`${lastDay}T00:00:00.000Z`) + DAY_MS;
    const page = await this.guard(() =>
      this.server('public')
        .tradeAggregation(
          Asset.native(),
          new Asset('USDC', USDC_CIRCLE_ISSUER.public),
          start,
          end,
          DAY_MS,
          0,
        )
        .order('asc')
        .limit(200)
        .call(),
    );
    const averages = new Map<string, string>();
    for (const record of page.records) {
      const day = new Date(Number(record.timestamp)).toISOString().slice(0, 10);
      averages.set(day, String(record.avg));
    }
    return averages;
  }

  /** PTAX de venda por dia útil. Fim de semana e feriado não vêm. */
  async ptaxSell(
    firstDay: string,
    lastDay: string,
  ): Promise<Map<string, string>> {
    const url =
      `${this.urls.ptax}/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
      `?@dataInicial='${bcbDate(firstDay)}'&@dataFinalCotacao='${bcbDate(lastDay)}'` +
      `&$top=1000&$format=json&$select=cotacaoVenda,dataHoraCotacao`;
    let body: { value?: { cotacaoVenda?: number; dataHoraCotacao?: string }[] };
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 429) {
        throw new GatewayRateLimitedError(
          readRetryAfter(response.headers.get('retry-after')),
        );
      }
      if (!response.ok) throw new GatewayUnavailableError(response.status);
      body = (await response.json()) as typeof body;
    } catch (error) {
      if (error instanceof GatewayRateLimitedError) throw error;
      if (error instanceof GatewayUnavailableError) throw error;
      throw new GatewayUnavailableError();
    }
    // A consulta pode trazer mais de um boletim no dia: vale o último.
    const rows = (body.value ?? [])
      .filter((row) => row.cotacaoVenda != null && row.dataHoraCotacao)
      .sort((left, right) =>
        String(left.dataHoraCotacao).localeCompare(
          String(right.dataHoraCotacao),
        ),
      );
    const rates = new Map<string, string>();
    for (const row of rows) {
      rates.set(
        String(row.dataHoraCotacao).slice(0, 10),
        String(row.cotacaoVenda),
      );
    }
    return rates;
  }

  private server(network: WalletNetwork): Horizon.Server {
    const known = this.servers.get(network);
    if (known) return known;
    const url = this.urls[network];
    const server = new Horizon.Server(url, {
      allowHttp: url.startsWith('http://'),
    });
    (server.httpClient.defaults as { timeout?: number }).timeout =
      REQUEST_TIMEOUT_MS;
    // O SDK joga fora os headers ao montar o NetworkError. Aqui eles ainda
    // existem: o status e o Retry-After seguem no corpo, no lugar do texto de fora.
    server.httpClient.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        const response = (error as { response?: HttpErrorResponse }).response;
        if (response) {
          response.data = {
            status: response.status,
            retryAfterSeconds: readRetryAfter(readHeader(response.headers)),
          };
        }
        throw error;
      },
    );
    this.servers.set(network, server);
    return server;
  }

  private async guard<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw translateSdkError(error);
    }
  }
}

type HttpErrorResponse = { status?: number; headers?: unknown; data?: unknown };

function readHeader(headers: unknown): string | null {
  if (headers instanceof Headers) return headers.get('retry-after');
  if (headers && typeof headers === 'object') {
    const value = (headers as Record<string, unknown>)['retry-after'];
    return typeof value === 'string' ? value : null;
  }
  return null;
}

/** Retry-After em segundos ou em data HTTP. */
export function readRetryAfter(
  value: string | null,
  now = Date.now(),
): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

function translateSdkError(error: unknown): Error {
  if (error instanceof NotFoundError) return new GatewayNotFoundError();
  if (error instanceof NetworkError) {
    const body = error.getResponse() as unknown as {
      status?: number;
      retryAfterSeconds?: number | null;
    };
    if (body?.status === 429) {
      return new GatewayRateLimitedError(body.retryAfterSeconds ?? null);
    }
    return new GatewayUnavailableError(body?.status ?? null);
  }
  return new GatewayUnavailableError();
}

function bcbDate(day: string): string {
  const [year, month, date] = day.split('-');
  return `${month}-${date}-${year}`;
}
