import { LedgerService } from './ledger.service';

function makeDeps(opts: {
  deposits: bigint[];
  vaultValue: bigint;
  address?: string;
  demoYieldBps?: number;
  demoReturnsChangePercent?: string;
  baselineSpendable?: bigint | null;
}) {
  const prisma = {
    deposit: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { amount: opts.deposits.reduce((a, b) => a + b, 0n) },
      }),
      create: vi.fn().mockResolvedValue({}),
    },
    yieldSnapshot: {
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(
        opts.baselineSpendable == null
          ? null
          : { spendable: opts.baselineSpendable },
      ),
    },
  } as any;
  const wallet = {
    getAddress: vi.fn().mockResolvedValue(opts.address ?? 'GADDR'),
  } as any;
  const vault = {
    getPositionValue: vi.fn().mockResolvedValue(opts.vaultValue),
  } as any;
  const config = {
    demoYieldBps: opts.demoYieldBps ?? 0,
    demoReturnsChangePercent: opts.demoReturnsChangePercent ?? '3.2',
  } as any;
  return {
    prisma,
    wallet,
    vault,
    svc: new LedgerService(prisma, vault, wallet, config),
  };
}

describe('LedgerService', () => {
  it('spendable = vaultValue - principal when positive', async () => {
    const { svc } = makeDeps({ deposits: [1000000n], vaultValue: 1075000n });
    const r = await svc.computeSpendable('co_1');
    expect(r.principal).toBe(1000000n);
    expect(r.vaultValue).toBe(1075000n);
    expect(r.spendable).toBe(75000n);
  });

  it('spendable clamps to 0 when vaultValue < principal', async () => {
    const { svc } = makeDeps({ deposits: [1000000n], vaultValue: 990000n });
    const r = await svc.computeSpendable('co_1');
    expect(r.spendable).toBe(0n);
  });

  it('principal sums multiple deposits', async () => {
    const { svc } = makeDeps({
      deposits: [1000000n, 500000n],
      vaultValue: 1600000n,
    });
    const r = await svc.computeSpendable('co_1');
    expect(r.principal).toBe(1500000n);
    expect(r.spendable).toBe(100000n);
  });

  it('demo: injeta rendimento sintético quando demoYieldBps > 0', async () => {
    // vaultValue real ~= principal (depósito recém-feito, sem rendimento).
    const { svc } = makeDeps({
      deposits: [1000000n],
      vaultValue: 1000000n,
      demoYieldBps: 320, // 3,2%
    });
    const r = await svc.computeSpendable('co_1');
    expect(r.vaultValue).toBe(1032000n);
    expect(r.spendable).toBe(32000n);
  });

  it('demo: não reduz vaultValue real maior que o sintético', async () => {
    const { svc } = makeDeps({
      deposits: [1000000n],
      vaultValue: 1100000n, // já rendeu mais que os 3,2% sintéticos
      demoYieldBps: 320,
    });
    const r = await svc.computeSpendable('co_1');
    expect(r.vaultValue).toBe(1100000n);
    expect(r.spendable).toBe(100000n);
  });

  it('principal is 0 with no deposits', async () => {
    const prisma = {
      deposit: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
    } as any;
    const svc = new LedgerService(prisma, {} as any, {} as any, {} as any);
    expect(await svc.principal('co_x')).toBe(0n);
  });

  it('returnsChange: % vs baseline de ~1 mês atrás', async () => {
    const { svc } = makeDeps({
      deposits: [1000000n],
      vaultValue: 1000000n,
      baselineSpendable: 100000n,
    });
    // atual = 110000 (10% acima de 100000) → "+10.0"
    expect(await svc.getReturnsChangePercent('co_1', 110000n)).toBe('+10.0');
  });

  it('returnsChange: variação negativa formata com sinal', async () => {
    const { svc } = makeDeps({
      deposits: [1000000n],
      vaultValue: 1000000n,
      baselineSpendable: 100000n,
    });
    expect(await svc.getReturnsChangePercent('co_1', 95000n)).toBe('-5.0');
  });

  it('returnsChange: sem histórico e sem demo → null', async () => {
    const { svc } = makeDeps({
      deposits: [1000000n],
      vaultValue: 1000000n,
      baselineSpendable: null,
    });
    expect(await svc.getReturnsChangePercent('co_1', 50000n)).toBeNull();
  });

  it('returnsChange: sem histórico, em demo → valor configurável com sinal', async () => {
    const { svc } = makeDeps({
      deposits: [1000000n],
      vaultValue: 1000000n,
      baselineSpendable: null,
      demoYieldBps: 320,
      demoReturnsChangePercent: '3.2',
    });
    expect(await svc.getReturnsChangePercent('co_1', 32000n)).toBe('+3.2');
  });

  it('recordDeposit stores venueId', async () => {
    const prisma = { deposit: { create: vi.fn().mockResolvedValue({}) } } as any;
    const svc = new LedgerService(prisma, {} as any, {} as any, {} as any);
    await svc.recordDeposit('co_1', 1_000_000n, 'tx1', 'solana:kamino');
    expect(prisma.deposit.create).toHaveBeenCalledWith({
      data: {
        companyId: 'co_1',
        amount: 1_000_000n,
        txHash: 'tx1',
        venueId: 'solana:kamino',
        rampOrderId: undefined,
      },
    });
  });

  it('recordWithdraw: grava um lançamento negativo (reduz principal)', async () => {
    const prisma = { deposit: { create: vi.fn().mockResolvedValue({}) } } as any;
    const svc = new LedgerService(prisma, {} as any, {} as any, {} as any);
    await svc.recordWithdraw('co_1', 250000n, 'TXW');
    expect(prisma.deposit.create).toHaveBeenCalledWith({
      data: {
        companyId: 'co_1',
        amount: -250000n,
        txHash: 'TXW',
        venueId: 'stellar:blend',
      },
    });
  });

  it('principal filters by venueId', async () => {
    const prisma = {
      deposit: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 500000n } }),
      },
    } as any;
    const svc = new LedgerService(prisma, {} as any, {} as any, {} as any);
    const result = await svc.principal('co_1', 'solana:kamino');
    expect(prisma.deposit.aggregate).toHaveBeenCalledWith({
      where: { companyId: 'co_1', venueId: 'solana:kamino' },
      _sum: { amount: true },
    });
    expect(result).toBe(500000n);
  });

  it('principal defaults to Stellar when venueId is not passed', async () => {
    const prisma = {
      deposit: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 1500000n } }),
      },
    } as any;
    const svc = new LedgerService(prisma, {} as any, {} as any, {} as any);
    await svc.principal('co_1');
    expect(prisma.deposit.aggregate).toHaveBeenCalledWith({
      where: { companyId: 'co_1', venueId: 'stellar:blend' },
      _sum: { amount: true },
    });
  });

  it('principal: clampa em 0 quando a soma é negativa', async () => {
    const prisma = {
      deposit: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: -5000n } }) },
    } as any;
    const svc = new LedgerService(prisma, {} as any, {} as any, {} as any);
    expect(await svc.principal('co_1')).toBe(0n);
  });
});
