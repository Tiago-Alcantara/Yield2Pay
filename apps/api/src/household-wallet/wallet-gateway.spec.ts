/**
 * Módulo: wallet-gateway
 * Criado em: 2026-11-04
 * Última atualização: 2026-11-04
 * Intuito: O stellar-sdk monta as URLs pedidas e nenhum erro de fora carrega o endereço, tudo contra um servidor HTTP local, sem rede.
 * Sequência: pede operations com join, order e limit, e entrega o tx embutido; 429 vira erro próprio com o Retry-After em segundos e em data; 404 de conta é "não existe"; 500 e queda não carregam a URL; effects por operação; média diária de XLM/USDC da Circle com resolução de um dia; PTAX de venda com o último boletim do dia, e erro sem a URL; as URLs reais são constantes do código.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WALLET_G } from '../../test/wallet-fixtures';
import { USDC_CIRCLE_ISSUER } from './classify-operation';
import {
  GatewayRateLimitedError,
  GatewayUnavailableError,
} from './wallet.errors';
import {
  readRetryAfter,
  WALLET_GATEWAY_URLS,
  WalletGateway,
  type GatewayUrls,
} from './wallet-gateway';

type Handler = (url: URL) => {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
};

describe('WalletGateway', () => {
  let server: Server;
  let urls: GatewayUrls;
  let handler: Handler = () => ({ status: 500 });
  const seen: URL[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      seen.push(url);
      const reply = handler(url);
      res.writeHead(reply.status ?? 200, {
        'Content-Type': 'application/json',
        ...reply.headers,
      });
      res.end(JSON.stringify(reply.body ?? {}));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    urls = {
      public: `http://127.0.0.1:${port}`,
      testnet: `http://127.0.0.1:${port}`,
      ptax: `http://127.0.0.1:${port}/ptax`,
    };
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    seen.length = 0;
  });

  const page = (records: unknown[]) => ({
    _links: { self: { href: '' }, next: { href: '' }, prev: { href: '' } },
    _embedded: { records },
  });

  async function failure(call: () => Promise<unknown>) {
    try {
      await call();
    } catch (error) {
      return error as Error;
    }
    throw new Error('deveria ter falhado');
  }

  function expectNoAddress(error: Error) {
    const text = `${error.name} ${error.message} ${error.stack} ${JSON.stringify(error)}`;
    expect(text).not.toContain(WALLET_G);
    expect(text).not.toContain('127.0.0.1');
  }

  it('pede operations com join, order e limit, e entrega o tx embutido', async () => {
    handler = () => ({
      body: page([
        {
          id: '12',
          paging_token: '12',
          type: 'payment',
          _links: { self: { href: '' }, transaction: { href: '' } },
          transaction: { hash: 'abc', fee_charged: '100' },
        },
      ]),
    });
    const gateway = new WalletGateway(urls);
    const records = await gateway.operations('public', WALLET_G, {
      cursor: '11',
      order: 'asc',
      limit: 200,
    });

    expect(seen[0]?.pathname).toBe(`/accounts/${WALLET_G}/operations`);
    expect(Object.fromEntries(seen[0]?.searchParams ?? [])).toMatchObject({
      join: 'transactions',
      order: 'asc',
      limit: '200',
      cursor: '11',
    });
    expect(records[0]?.transaction_attr).toMatchObject({ hash: 'abc' });
  });

  it('429 vira erro próprio com o Retry-After, sem o endereço', async () => {
    handler = () => ({
      status: 429,
      headers: { 'Retry-After': '17' },
      body: { title: 'Rate Limit Exceeded', status: 429 },
    });
    const gateway = new WalletGateway(urls);
    const error = await failure(() =>
      gateway.operations('public', WALLET_G, {
        cursor: null,
        order: 'asc',
        limit: 200,
      }),
    );

    expect(error).toBeInstanceOf(GatewayRateLimitedError);
    expect((error as GatewayRateLimitedError).retryAfterSeconds).toBe(17);
    expectNoAddress(error);
  });

  it('lê o Retry-After em segundos e em data', () => {
    const now = Date.parse('2026-11-04T12:00:00Z');
    expect(readRetryAfter('30', now)).toBe(30);
    expect(readRetryAfter('Wed, 04 Nov 2026 12:01:00 GMT', now)).toBe(60);
    expect(readRetryAfter('Wed, 04 Nov 2026 11:59:00 GMT', now)).toBe(0);
    expect(readRetryAfter('depois', now)).toBeNull();
    expect(readRetryAfter(null, now)).toBeNull();
  });

  it('404 de conta é "não existe"; outro erro não carrega o endereço', async () => {
    const gateway = new WalletGateway(urls);
    handler = () => ({ status: 404, body: { status: 404 } });
    await expect(gateway.accountExists('testnet', WALLET_G)).resolves.toBe(
      false,
    );
    expect(seen[0]?.pathname).toBe(`/accounts/${WALLET_G}`);

    handler = () => ({ body: { id: WALLET_G, _links: {} } });
    await expect(gateway.accountExists('testnet', WALLET_G)).resolves.toBe(
      true,
    );

    handler = () => ({ status: 500, body: { detail: WALLET_G } });
    const error = await failure(() =>
      gateway.accountExists('testnet', WALLET_G),
    );
    expect(error).toBeInstanceOf(GatewayUnavailableError);
    expectNoAddress(error);
  });

  it('queda de conexão não carrega a URL', async () => {
    const gateway = new WalletGateway({
      ...urls,
      public: 'http://127.0.0.1:1',
    });
    const error = await failure(() =>
      gateway.accountExists('public', WALLET_G),
    );
    expect(error).toBeInstanceOf(GatewayUnavailableError);
    expectNoAddress(error);
  });

  it('busca effects pela operação', async () => {
    handler = () => ({
      body: page([{ type: 'account_credited', amount: '1.0000000' }]),
    });
    const effects = await new WalletGateway(urls).effects('public', '99');
    expect(seen[0]?.pathname).toBe('/operations/99/effects');
    expect(effects[0]).toMatchObject({ type: 'account_credited' });
  });

  it('pede a média diária de XLM/USDC da Circle, resolução de um dia', async () => {
    handler = () => ({
      body: page([
        { timestamp: Date.parse('2026-10-01T00:00:00Z'), avg: '0.3100000' },
        {
          timestamp: `${Date.parse('2026-10-02T00:00:00Z')}`,
          avg: '0.3200000',
        },
      ]),
    });
    // Sempre na mainnet: a testnet aqui nem responde.
    const averages = await new WalletGateway({
      ...urls,
      testnet: 'http://127.0.0.1:1',
    }).xlmUsdcDailyAverages('2026-10-01', '2026-10-02');

    expect(seen[0]?.pathname).toBe('/trade_aggregations');
    expect(Object.fromEntries(seen[0]?.searchParams ?? [])).toMatchObject({
      base_asset_type: 'native',
      counter_asset_code: 'USDC',
      counter_asset_issuer: USDC_CIRCLE_ISSUER.public,
      resolution: '86400000',
      start_time: String(Date.parse('2026-10-01T00:00:00Z')),
      end_time: String(Date.parse('2026-10-03T00:00:00Z')),
    });
    expect([...averages]).toEqual([
      ['2026-10-01', '0.3100000'],
      ['2026-10-02', '0.3200000'],
    ]);
  });

  it('lê a PTAX de venda, com o último boletim do dia', async () => {
    handler = () => ({
      body: {
        value: [
          { cotacaoVenda: 5.5, dataHoraCotacao: '2026-10-01 13:04:00.000' },
          { cotacaoVenda: 5.4, dataHoraCotacao: '2026-10-01 10:04:00.000' },
          { cotacaoVenda: 5.6, dataHoraCotacao: '2026-10-02 13:04:00.000' },
        ],
      },
    });
    const rates = await new WalletGateway(urls).ptaxSell(
      '2026-10-01',
      '2026-10-02',
    );

    const asked = decodeURIComponent(`${seen[0]?.pathname}${seen[0]?.search}`);
    expect(asked).toContain('/ptax/CotacaoDolarPeriodo(');
    expect(asked).toContain("@dataInicial='10-01-2026'");
    expect(asked).toContain("@dataFinalCotacao='10-02-2026'");
    expect(asked).toContain('$format=json');
    expect([...rates]).toEqual([
      ['2026-10-01', '5.5'],
      ['2026-10-02', '5.6'],
    ]);

    handler = () => ({ status: 503 });
    const error = await failure(() =>
      new WalletGateway(urls).ptaxSell('2026-10-01', '2026-10-02'),
    );
    expect(error).toBeInstanceOf(GatewayUnavailableError);
    expectNoAddress(error);
  });

  it('as URLs reais são constantes do código', () => {
    expect(WALLET_GATEWAY_URLS).toEqual({
      public: 'https://horizon.stellar.org',
      testnet: 'https://horizon-testnet.stellar.org',
      ptax: 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata',
    });
  });
});
