import { Account, MuxedAccount, StrKey } from '@stellar/stellar-sdk';
import type {
  HorizonEffect,
  HorizonOperation,
} from '../src/household-wallet/classify-operation';
import {
  GatewayRateLimitedError,
  GatewayUnavailableError,
} from '../src/household-wallet/wallet.errors';
import type { OperationsQuery } from '../src/household-wallet/wallet-gateway';

/** Endereços fixos, gerados com checksum real e sem conta de verdade por trás. */
export const WALLET_G = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1));
export const OTHER_G = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 3));
export const SECRET_S = StrKey.encodeEd25519SecretSeed(Buffer.alloc(32, 2));
export const WALLET_M42 = new MuxedAccount(
  new Account(WALLET_G, '0'),
  '42',
).accountId();
export const WALLET_M43 = new MuxedAccount(
  new Account(WALLET_G, '0'),
  '43',
).accountId();

let nextToken = 1000n;

/** Operação do Horizon, com o tx embutido do join=transactions. */
export function horizonOp(
  fields: Partial<HorizonOperation> & { type: string },
): HorizonOperation {
  nextToken += 1n;
  const token = nextToken.toString();
  return {
    id: token,
    paging_token: token,
    created_at: new Date().toISOString(),
    transaction_hash: `hash-${token}`,
    transaction_successful: true,
    source_account: OTHER_G,
    transaction_attr: {
      source_account: OTHER_G,
      fee_account: OTHER_G,
      fee_charged: '100',
    },
    ...fields,
  };
}

export const xlmPayment = (
  from: string,
  to: string,
  amount: string,
  extra: Partial<HorizonOperation> = {},
) =>
  horizonOp({
    type: 'payment',
    from,
    to,
    amount,
    asset_type: 'native',
    ...extra,
  });

/**
 * Horizon e BCB simulados. Implementa o que o sync, o preço e o cadastro chamam,
 * sem rede. Preço padrão: XLM a US$ 0,50 e dólar a R$ 5,00, ou 250 centavos por XLM.
 */
export class FakeGateway {
  operationsByAccount = new Map<string, HorizonOperation[]>();
  effectsByOp = new Map<string, HorizonEffect[]>();
  existing = new Set<string>([WALLET_G, OTHER_G]);
  ptax: Map<string, string> | null = null;
  averages: Map<string, string> | null = null;
  /** Falha a partir desta chamada de operations, contando do zero. */
  failOperationsAt: number | null = null;
  failWith: Error = new GatewayRateLimitedError(120);
  calls = { operations: [] as OperationsQuery[], effects: 0, ptax: 0, xlm: 0 };
  networksAsked: string[] = [];

  setOperations(account: string, operations: HorizonOperation[]) {
    this.operationsByAccount.set(account, operations);
  }

  async accountExists(_network: string, accountId: string) {
    return this.existing.has(accountId);
  }

  async operations(
    network: string,
    accountId: string,
    query: OperationsQuery,
  ): Promise<HorizonOperation[]> {
    this.networksAsked.push(network);
    const index = this.calls.operations.length;
    this.calls.operations.push(query);
    if (this.failOperationsAt != null && index >= this.failOperationsAt) {
      throw this.failWith;
    }
    const all = [...(this.operationsByAccount.get(accountId) ?? [])].sort(
      (left, right) =>
        Number(BigInt(left.paging_token) - BigInt(right.paging_token)),
    );
    const cursor = query.cursor == null ? null : BigInt(query.cursor);
    if (query.order === 'asc') {
      return all
        .filter((op) => cursor == null || BigInt(op.paging_token) > cursor)
        .slice(0, query.limit);
    }
    return all
      .reverse()
      .filter((op) => cursor == null || BigInt(op.paging_token) < cursor)
      .slice(0, query.limit);
  }

  async effects(_network: string, operationId: string) {
    this.calls.effects += 1;
    return this.effectsByOp.get(operationId) ?? [];
  }

  async xlmUsdcDailyAverages(firstDay: string, lastDay: string) {
    this.calls.xlm += 1;
    if (this.averages) return this.averages;
    const result = new Map<string, string>();
    for (const day of daysBetween(firstDay, lastDay)) result.set(day, '0.5');
    return result;
  }

  async ptaxSell(firstDay: string, lastDay: string) {
    this.calls.ptax += 1;
    if (this.ptax) return this.ptax;
    const result = new Map<string, string>();
    for (const day of daysBetween(firstDay, lastDay)) result.set(day, '5');
    return result;
  }

  /** BCB fora do ar. */
  breakPrices() {
    this.ptaxSell = async () => {
      this.calls.ptax += 1;
      throw new GatewayUnavailableError(503);
    };
  }
}

function daysBetween(first: string, last: string): string[] {
  const days: string[] = [];
  let at = Date.parse(`${first}T00:00:00.000Z`);
  const end = Date.parse(`${last}T00:00:00.000Z`);
  while (at <= end) {
    days.push(new Date(at).toISOString().slice(0, 10));
    at += 86_400_000;
  }
  return days;
}

/** Tudo o que a aplicação escreve no terminal enquanto o teste roda. */
export function captureLogs() {
  const lines: string[] = [];
  const keep = (...args: unknown[]) => {
    lines.push(
      args
        .map((arg) =>
          arg instanceof Error
            ? `${arg.name} ${arg.message} ${arg.stack ?? ''} ${JSON.stringify(arg)}`
            : typeof arg === 'string'
              ? arg
              : JSON.stringify(arg, (_key, value: unknown) =>
                  typeof value === 'bigint' ? value.toString() : value,
                ),
        )
        .join(' '),
    );
  };
  const spies = [
    vi.spyOn(console, 'log').mockImplementation(keep),
    vi.spyOn(console, 'info').mockImplementation(keep),
    vi.spyOn(console, 'warn').mockImplementation(keep),
    vi.spyOn(console, 'error').mockImplementation(keep),
    vi.spyOn(console, 'debug').mockImplementation(keep),
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      keep(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      keep(String(chunk));
      return true;
    }),
  ];
  return {
    text: () => lines.join('\n'),
    count: () => lines.length,
    restore: () => spies.forEach((spy) => spy.mockRestore()),
  };
}
