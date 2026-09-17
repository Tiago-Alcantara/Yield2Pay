import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { VenueService } from './venue.service';
import { VENUE_REGISTRY } from './venue.tokens';
import { VenueRegistry } from '@yield2pay/venue-core';
import { createStellarBlendPlugin } from '@yield2pay/venue-stellar-blend';
import { createSolanaKaminoPlugin } from '@yield2pay/venue-solana-kamino';

function mockRegistry() {
  const registry = new VenueRegistry();
  registry.register(createStellarBlendPlugin({ mode: 'mock' }));
  registry.register(createSolanaKaminoPlugin({ mode: 'mock' }));
  return registry;
}

function svc(overrides?: {
  company?: { selectedChain: string; unlockedChains: string[] };
  stellarAddress?: string;
  solanaAddress?: string | null;
}) {
  const company = overrides?.company ?? {
    selectedChain: 'stellar',
    unlockedChains: ['stellar'],
  };
  const prisma = {
    company: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(company),
      update: vi.fn().mockImplementation(async ({ data }: { data: typeof company }) => {
        Object.assign(company, data);
        return company;
      }),
    },
  };
  const wallet = {
    getAddress: vi.fn().mockResolvedValue(overrides?.stellarAddress ?? 'GADDR'),
    getSolanaAddress: vi
      .fn()
      .mockResolvedValue(
        overrides?.solanaAddress === undefined
          ? 'So11111111111111111111111111111111111111112'
          : overrides.solanaAddress,
      ),
  };
  const ledger = {
    recordDeposit: vi.fn().mockResolvedValue(undefined),
    recordWithdraw: vi.fn().mockResolvedValue(undefined),
  };
  return {
    prisma,
    wallet,
    ledger,
    company,
    service: new VenueService(
      mockRegistry(),
      prisma as never,
      wallet as never,
      ledger as never,
    ),
  };
}

describe('VenueService', () => {
  it('lista os dois plugins', () => {
    const { service } = svc();
    expect(service.list().map((v) => v.id)).toEqual([
      'stellar:blend',
      'solana:kamino',
    ]);
  });

  it('recusa deposit em solana se a chain está locked', async () => {
    const { service } = svc();
    await expect(
      service.buildDeposit('co_1', 'solana', 'kamino', '1000000'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deposita no mock stellar e grava ledger', async () => {
    const { service, ledger } = svc();
    const unsigned = await service.buildDeposit('co_1', 'stellar', 'blend', '10000000');
    if (!('xdr' in unsigned)) throw new Error('expected stellar');
    const result = await service.submitDeposit('co_1', 'stellar', 'blend', {
      amount: '10000000',
      xdr: unsigned.xdr,
      signatureHex: '0xdemo',
      stellarAddress: 'GADDR',
    });
    expect(result.txHash).toMatch(/^stellar-mock-/);
    expect(ledger.recordDeposit).toHaveBeenCalledWith(
      'co_1',
      10000000n,
      expect.stringMatching(/^stellar-mock-/),
      'stellar:blend',
    );
  });

  it('rejeita amount diferente do depósito codificado no mock', async () => {
    const { service, ledger } = svc();
    const unsigned = await service.buildDeposit(
      'co_1',
      'stellar',
      'blend',
      '10000000',
    );
    if (!('xdr' in unsigned)) throw new Error('expected stellar');

    await expect(
      service.submitDeposit('co_1', 'stellar', 'blend', {
        amount: '90000000',
        xdr: unsigned.xdr,
        signatureHex: '0xdemo',
        stellarAddress: 'GADDR',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(ledger.recordDeposit).not.toHaveBeenCalled();
  });

  it('unlock + select libera kamino mock', async () => {
    const { service, ledger } = svc({
      solanaAddress: 'So11111111111111111111111111111111111111112',
    });
    await service.unlock('co_1', 'solana');
    await service.select('co_1', 'solana');
    const unsigned = await service.buildDeposit('co_1', 'solana', 'kamino', '1000000');
    if (!('transactionBase64' in unsigned)) throw new Error('expected solana');
    const result = await service.submitDeposit('co_1', 'solana', 'kamino', {
      amount: '1000000',
      signedTransactionBase64: unsigned.transactionBase64,
    });
    expect(result.txHash).toMatch(/^solana-mock-/);
    expect(ledger.recordDeposit).toHaveBeenCalledWith(
      'co_1',
      1000000n,
      expect.stringMatching(/^solana-mock-/),
      'solana:kamino',
    );
  });

  it('rejeita amount diferente do saque codificado no mock Solana', async () => {
    const { service, ledger } = svc({
      company: {
        selectedChain: 'solana',
        unlockedChains: ['stellar', 'solana'],
      },
    });
    const unsigned = await service.buildWithdraw(
      'co_1',
      'solana',
      'kamino',
      '1000000',
    );
    if (!('transactionBase64' in unsigned)) {
      throw new Error('expected solana');
    }

    await expect(
      service.submitWithdraw('co_1', 'solana', 'kamino', {
        amount: '9000000',
        signedTransactionBase64: unsigned.transactionBase64,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(ledger.recordWithdraw).not.toHaveBeenCalled();
  });

  it('select sem unlock falha', async () => {
    const { service } = svc();
    await expect(service.select('co_1', 'solana')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejeita amount inválido', async () => {
    const { service } = svc();
    await expect(
      service.buildDeposit('co_1', 'stellar', 'blend', 'nope'),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('VENUE_REGISTRY token', () => {
  it('is a stable string', () => {
    expect(VENUE_REGISTRY).toBe('VENUE_REGISTRY');
  });
});
