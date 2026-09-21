import { ForbiddenException } from '@nestjs/common';
import { CompanyService } from './company.service';

const prisma = {
  company: {
    upsert: vi.fn().mockResolvedValue({ id: 'co_1' }),
  },
} as any;

it('find-or-creates by privyUserId', async () => {
  const svc = new CompanyService(prisma);
  const c = await svc.findOrCreate('did:privy:abc');
  expect(c.id).toBe('co_1');
  expect(prisma.company.upsert).toHaveBeenCalledWith({
    where: { privyUserId: 'did:privy:abc' },
    create: { privyUserId: 'did:privy:abc' },
    update: {},
  });
});

it('exportAccount returns company bills and deposits as strings', async () => {
  const prisma = {
    company: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 'co_1',
        privyUserId: 'did:privy:abc',
        createdAt: new Date('2026-01-01'),
      }),
    },
    recurringBill: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'b1',
          vendor: 'OpenAI',
          monthlyCost: 2000000n,
          type: 'software',
          status: 'active',
          createdAt: new Date('2026-01-02'),
        },
      ]),
    },
    deposit: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'd1',
          amount: 100n,
          txHash: 'abc',
          createdAt: new Date('2026-01-03'),
        },
      ]),
    },
  } as any;
  const svc = new CompanyService(prisma);
  const exported = await svc.exportAccount('co_1');
  expect(exported.bills[0].monthlyCost).toBe('2000000');
  expect(exported.deposits[0].amount).toBe('100');
});

it('deleteAccount refuses when deposits exist', async () => {
  const prisma = {
    deposit: { count: vi.fn().mockResolvedValue(1) },
    $transaction: vi.fn(),
  } as any;
  const svc = new CompanyService(prisma);
  await expect(svc.deleteAccount('co_1')).rejects.toBeInstanceOf(
    ForbiddenException,
  );
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

it('deleteAccount removes child rows then the company', async () => {
  const tx = {
    recurringBill: { deleteMany: vi.fn() },
    yieldSnapshot: { deleteMany: vi.fn() },
    rampOrder: { deleteMany: vi.fn() },
    etherfuseCustomer: { deleteMany: vi.fn() },
    wallet: { deleteMany: vi.fn() },
    deposit: { deleteMany: vi.fn() },
    company: { delete: vi.fn() },
  };
  const prisma = {
    deposit: { count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
  } as any;
  const svc = new CompanyService(prisma);
  await svc.deleteAccount('co_1');
  expect(tx.company.delete).toHaveBeenCalledWith({ where: { id: 'co_1' } });
});
