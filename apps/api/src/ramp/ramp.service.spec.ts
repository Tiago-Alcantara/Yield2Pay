/**
 * Módulo: ramp.service
 * Criado em: 2026-06-30
 * Última atualização: 2026-10-22
 * Intuito: A ordem de on-ramp é iniciada, simulada e reivindicada só pela company dona.
 * Sequência: getOrderClaim: skip=true quando a order não tem claimable; getOrderClaim: retorna xdr+hash quando há stellarClaimTransaction; getOrderClaim: 404 quando a order não é da company; submitOrderClaim: anexa assinatura, submete e marca claimed; submitOrderClaim: Forbidden quando o address não bate com a wallet registrada; startOnramp: no 409, cancela order pendente própria e retenta uma vez; startOnramp: 409 sem order própria cancelável → BadRequest (conflito de outra empresa); simulateFiatReceived: order em created → chama fiat_received e marca funded; simulateFiatReceived: order já completed → no-op idempotente, sem 404.
 */
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { RampService } from './ramp.service';

function make(
  overrides: {
    order?: any;
    efOrder?: any;
    registered?: string;
  } = {},
) {
  const prisma = {
    rampOrder: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          overrides.order ?? {
            orderId: 'o1',
            companyId: 'co_1',
            status: 'funded',
          },
        ),
      update: vi.fn().mockResolvedValue(undefined),
    },
    etherfuseCustomer: { findUnique: vi.fn() },
  };
  const wallet = {
    getAddress: vi.fn().mockResolvedValue(overrides.registered ?? 'GADDR'),
  };
  const stellar = {
    hashForSigning: vi.fn().mockReturnValue({ hash: '0xhash' }),
    attachAndSubmit: vi.fn().mockResolvedValue({ txHash: 'CLAIMTX' }),
  };
  const ef = {
    getOrder: vi
      .fn()
      .mockResolvedValue(
        overrides.efOrder ?? { orderId: 'o1', status: 'completed' },
      ),
  };
  const svc = new RampService(
    prisma as any,
    wallet as any,
    stellar as any,
    ef as any,
  );
  return { svc, prisma, wallet, stellar, ef };
}

describe('ramp.service', () => {
  it('getOrderClaim: skip=true quando a order não tem claimable', async () => {
    const { svc } = make({ efOrder: { orderId: 'o1', status: 'completed' } });
    const r = await svc.getOrderClaim('co_1', 'o1');
    expect(r).toEqual({ skip: true });
  });

  it('getOrderClaim: retorna xdr+hash quando há stellarClaimTransaction', async () => {
    const { svc } = make({
      efOrder: {
        orderId: 'o1',
        status: 'completed',
        stellarClaimTransaction: 'AAAA',
      },
    });
    const r = await svc.getOrderClaim('co_1', 'o1');
    expect(r).toEqual({ skip: false, xdr: 'AAAA', hash: '0xhash' });
  });

  it('getOrderClaim: 404 quando a order não é da company', async () => {
    const { svc } = make({
      order: { orderId: 'o1', companyId: 'outra', status: 'funded' },
    });
    await expect(svc.getOrderClaim('co_1', 'o1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('submitOrderClaim: anexa assinatura, submete e marca claimed', async () => {
    const { svc, prisma, stellar } = make();
    const r = await svc.submitOrderClaim('co_1', 'o1', {
      xdr: 'X',
      signatureHex: '0xsig',
      stellarAddress: 'GADDR',
    });
    expect(stellar.attachAndSubmit).toHaveBeenCalledWith('X', 'GADDR', '0xsig');
    expect(prisma.rampOrder.update).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
      data: { status: 'claimed' },
    });
    expect(r).toEqual({ txHash: 'CLAIMTX' });
  });

  it('submitOrderClaim: Forbidden quando o address não bate com a wallet registrada', async () => {
    const { svc, stellar } = make({ registered: 'GADDR' });
    await expect(
      svc.submitOrderClaim('co_1', 'o1', {
        xdr: 'X',
        signatureHex: '0xsig',
        stellarAddress: 'GEVIL',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(stellar.attachAndSubmit).not.toHaveBeenCalled();
  });

  // ── startOnramp: 409 (order pendente duplicada) ─────────────────────────────

  function makeOnramp(overrides: { pending?: any[]; conflict?: boolean } = {}) {
    let createCalls = 0;
    const prisma = {
      etherfuseCustomer: {
        findUnique: vi.fn().mockResolvedValue({
          customerId: 'cust_1',
          kycStatus: 'approved',
          bankAccountId: 'bank_1',
        }),
      },
      rampOrder: {
        findMany: vi.fn().mockResolvedValue(overrides.pending ?? []),
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
    const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
    const stellar = {};
    const ef = {
      fiatCurrency: 'BRL',
      pickAsset: vi
        .fn()
        .mockResolvedValue({ identifier: 'USDC:GISS', symbol: 'USDC' }),
      createQuote: vi.fn().mockResolvedValue({
        quoteId: 'q1',
        targetAmount: '18.00',
        feeAmount: '0.20',
        expiresAt: '2026-01-01T00:00:00Z',
      }),
      createOrder: vi.fn().mockImplementation(() => {
        createCalls++;
        if (overrides.conflict && createCalls === 1) {
          throw new HttpException(
            'A pending onramp order already exists for this bank account and amount',
            HttpStatus.CONFLICT,
          );
        }
        return Promise.resolve({
          orderId: 'new1',
          status: 'created',
          depositClabe: '123',
          depositBankName: 'Banco',
          statusPage: 'https://s',
        });
      }),
      cancelOrder: vi.fn().mockResolvedValue(undefined),
    };
    const svc = new RampService(
      prisma as any,
      wallet as any,
      stellar as any,
      ef as any,
    );
    return { svc, prisma, ef };
  }

  it('startOnramp: no 409, cancela order pendente própria e retenta uma vez', async () => {
    const { svc, prisma, ef } = makeOnramp({
      conflict: true,
      pending: [{ orderId: 'old1' }],
    });
    const r = await svc.startOnramp('co_1', '100');
    expect(ef.cancelOrder).toHaveBeenCalledWith('old1');
    expect(prisma.rampOrder.update).toHaveBeenCalledWith({
      where: { orderId: 'old1' },
      data: { status: 'cancelled' },
    });
    expect(ef.createOrder).toHaveBeenCalledTimes(2);
    expect(r.depositClabe).toBe('123');
  });

  it('startOnramp: 409 sem order própria cancelável → BadRequest (conflito de outra empresa)', async () => {
    const { svc, ef } = makeOnramp({ conflict: true, pending: [] });
    await expect(svc.startOnramp('co_1', '100')).rejects.toThrow(
      BadRequestException,
    );
    expect(ef.cancelOrder).not.toHaveBeenCalled();
    expect(ef.createOrder).toHaveBeenCalledTimes(1);
  });

  // ── simulateFiatReceived: idempotência (clique duplo) ───────────────────────

  function makeSimulate(efStatus: string) {
    const prisma = {
      rampOrder: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            orderId: 'o1',
            companyId: 'co_1',
            status: 'created',
          }),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
    const ef = {
      getOrder: vi.fn().mockResolvedValue({ orderId: 'o1', status: efStatus }),
      simulateFiatReceived: vi.fn().mockResolvedValue(undefined),
    };
    const svc = new RampService(prisma as any, {} as any, {} as any, ef as any);
    return { svc, prisma, ef };
  }

  it('simulateFiatReceived: order em created → chama fiat_received e marca funded', async () => {
    const { svc, prisma, ef } = makeSimulate('created');
    await svc.simulateFiatReceived('co_1', 'o1');
    expect(ef.simulateFiatReceived).toHaveBeenCalledWith('o1');
    expect(prisma.rampOrder.update).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
      data: { status: 'funded' },
    });
  });

  it('simulateFiatReceived: order já completed → no-op idempotente, sem 404', async () => {
    const { svc, prisma, ef } = makeSimulate('completed');
    await svc.simulateFiatReceived('co_1', 'o1');
    expect(ef.simulateFiatReceived).not.toHaveBeenCalled();
    expect(prisma.rampOrder.update).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
      data: { status: 'completed' },
    });
  });
});
