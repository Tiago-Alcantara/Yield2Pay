import { LedgerService } from './ledger.service';

function makeDeps(opts: {
  deposits: bigint[];
  vaultValue: bigint;
  address?: string;
}) {
  const prisma = {
    deposit: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { amount: opts.deposits.reduce((a, b) => a + b, 0n) },
      }),
      create: vi.fn().mockResolvedValue({}),
    },
    yieldSnapshot: { create: vi.fn().mockResolvedValue({}) },
  } as any;
  const wallet = {
    getAddress: vi.fn().mockResolvedValue(opts.address ?? 'GADDR'),
  } as any;
  const vault = {
    getPositionValue: vi.fn().mockResolvedValue(opts.vaultValue),
  } as any;
  return {
    prisma,
    wallet,
    vault,
    svc: new LedgerService(prisma, vault, wallet),
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

  it('principal is 0 with no deposits', async () => {
    const prisma = {
      deposit: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
    } as any;
    const svc = new LedgerService(prisma, {} as any, {} as any);
    expect(await svc.principal('co_x')).toBe(0n);
  });
});
