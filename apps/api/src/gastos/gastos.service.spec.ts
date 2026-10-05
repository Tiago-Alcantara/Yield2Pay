import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  GastosService,
  monthRange,
  parseCentavos,
  saoPauloTodayDate,
  saoPauloYearMonth,
} from './gastos.service';

const SP_KEY = '35261000000000000191650010000000011000000013';

it('accepts a positive centavos integer', () => {
  expect(parseCentavos(1)).toBe(1);
  expect(parseCentavos(17119)).toBe(17119);
  expect(parseCentavos(2147483647)).toBe(2147483647);
});

it('rejects USDC-style strings, zero, fractions, and values above int4', () => {
  for (const bad of ['17119', 0, -1, 1.5, 2147483648, null]) {
    expect(() => parseCentavos(bad)).toThrow(BadRequestException);
  }
});

it('keeps 2026-10-01T02:30Z in September because São Paulo is still on the 30th', () => {
  const instant = new Date('2026-10-01T02:30:00.000Z');
  expect(saoPauloYearMonth(instant)).toBe('2026-09');
  expect(saoPauloTodayDate(instant).toISOString()).toBe('2026-09-30T00:00:00.000Z');
});

it('rolls the month at 2026-10-01T03:00Z', () => {
  const instant = new Date('2026-10-01T03:00:00.000Z');
  expect(saoPauloYearMonth(instant)).toBe('2026-10');
  expect(saoPauloTodayDate(instant).toISOString()).toBe('2026-10-01T00:00:00.000Z');
});

it('returns a half-open UTC range for a calendar month', () => {
  expect(monthRange('2026-10')).toEqual({
    start: new Date('2026-10-01T00:00:00.000Z'),
    end: new Date('2026-11-01T00:00:00.000Z'),
  });
});

it('saves the account and does not create a month expense', async () => {
  const prisma = {
    recurringAccount: {
      create: vi.fn().mockResolvedValue({ id: 'acc_1', name: 'Luz', amountCents: 15000 }),
    },
    monthExpense: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  } as any;
  const svc = new GastosService(prisma);
  const row = await svc.createConta('co_1', { name: 'Luz', amountCents: 15000 });
  expect(prisma.recurringAccount.create).toHaveBeenCalledWith({
    data: { companyId: 'co_1', name: 'Luz', amountCents: 15000 },
  });
  expect(prisma.monthExpense.create).not.toHaveBeenCalled();
  expect(row).toEqual({ id: 'acc_1', name: 'Luz', amountCents: 15000, spentThisMonth: false });
});

it('lists only this company and marks an account already spent in the São Paulo month', async () => {
  const prisma = {
    recurringAccount: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'acc_1', name: 'Luz', amountCents: 15000 },
        { id: 'acc_2', name: 'Aluguel', amountCents: 200000 },
      ]),
    },
    monthExpense: {
      findMany: vi.fn().mockResolvedValue([{ recurringAccountId: 'acc_1' }]),
    },
  } as any;
  const svc = new GastosService(prisma);
  const rows = await svc.listContas('co_1', new Date('2026-10-04T15:00:00.000Z'));
  expect(prisma.recurringAccount.findMany).toHaveBeenCalledWith({
    where: { companyId: 'co_1' },
    orderBy: { createdAt: 'asc' },
  });
  expect(prisma.monthExpense.findMany).toHaveBeenCalledWith({
    where: { companyId: 'co_1', yearMonth: '2026-10', recurringAccountId: { not: null } },
    select: { recurringAccountId: true },
  });
  expect(rows.map((r) => r.spentThisMonth)).toEqual([true, false]);
});

it('já gastei copies the saved account into one month row with the chosen category', async () => {
  const prisma = {
    recurringAccount: {
      findFirst: vi.fn().mockResolvedValue({ id: 'acc_1', name: 'Luz', amountCents: 15000 }),
    },
    monthExpense: {
      create: vi.fn().mockResolvedValue({
        id: 'exp_1',
        amountCents: 15000,
        merchant: 'Luz',
        spentOn: new Date('2026-10-04T00:00:00.000Z'),
        source: 'conta',
        category: 'conta_da_casa',
      }),
    },
  } as any;
  const svc = new GastosService(prisma);
  const row = await svc.jaGastei(
    'co_1',
    'acc_1',
    { category: 'conta_da_casa' },
    new Date('2026-10-04T15:00:00.000Z'),
  );
  expect(prisma.recurringAccount.findFirst).toHaveBeenCalledWith({
    where: { id: 'acc_1', companyId: 'co_1' },
  });
  expect(prisma.monthExpense.create).toHaveBeenCalledWith({
    data: {
      companyId: 'co_1',
      amountCents: 15000,
      merchant: 'Luz',
      spentOn: new Date('2026-10-04T00:00:00.000Z'),
      source: 'conta',
      category: 'conta_da_casa',
      accessKey: null,
      recurringAccountId: 'acc_1',
      yearMonth: '2026-10',
    },
  });
  expect(row).toEqual({
    id: 'exp_1',
    amountCents: 15000,
    merchant: 'Luz',
    spentOn: '2026-10-04',
    source: 'conta',
    category: 'conta_da_casa',
  });
});

it('a second já gastei in the same month does not create a row', async () => {
  const prisma = {
    recurringAccount: {
      findFirst: vi.fn().mockResolvedValue({ id: 'acc_1', name: 'Luz', amountCents: 15000 }),
    },
    monthExpense: { create: vi.fn().mockRejectedValue({ code: 'P2002' }) },
  } as any;
  const svc = new GastosService(prisma);
  await expect(
    svc.jaGastei('co_1', 'acc_1', { category: 'conta_da_casa' }, new Date('2026-10-04T15:00:00.000Z')),
  ).rejects.toBeInstanceOf(ConflictException);
});

it('does not spend another company account', async () => {
  const prisma = {
    recurringAccount: { findFirst: vi.fn().mockResolvedValue(null) },
    monthExpense: { create: vi.fn() },
  } as any;
  const svc = new GastosService(prisma);
  await expect(svc.jaGastei('co_1', 'acc_9', { category: 'outros' })).rejects.toBeInstanceOf(
    NotFoundException,
  );
  expect(prisma.monthExpense.create).not.toHaveBeenCalled();
});

it('confirmNota stores editable fields and an optional 44-digit key without calling out', async () => {
  const prisma = {
    monthExpense: {
      create: vi.fn().mockResolvedValue({
        id: 'exp_2',
        amountCents: 1990,
        merchant: 'Padaria',
        spentOn: new Date('2026-10-04T00:00:00.000Z'),
        source: 'nota',
        category: 'mercado',
      }),
    },
  } as any;
  const svc = new GastosService(prisma);
  const row = await svc.confirmNota('co_1', {
    accessKey: SP_KEY,
    merchant: 'Padaria',
    amountCents: 1990,
    spentOn: '2026-10-04',
    category: 'mercado',
  });
  expect(prisma.monthExpense.create).toHaveBeenCalledWith({
    data: {
      companyId: 'co_1',
      amountCents: 1990,
      merchant: 'Padaria',
      spentOn: new Date('2026-10-04T00:00:00.000Z'),
      source: 'nota',
      category: 'mercado',
      accessKey: SP_KEY,
      recurringAccountId: null,
      yearMonth: null,
    },
  });
  expect(row.source).toBe('nota');
});

it('confirmNota stores a receipt with no access key', async () => {
  const prisma = {
    monthExpense: {
      create: vi.fn().mockResolvedValue({
        id: 'exp_3',
        amountCents: 1000,
        merchant: 'Feira',
        spentOn: new Date('2026-10-04T00:00:00.000Z'),
        source: 'nota',
        category: 'outros',
      }),
    },
  } as any;
  const svc = new GastosService(prisma);
  await svc.confirmNota('co_1', {
    merchant: 'Feira',
    amountCents: 1000,
    spentOn: '2026-10-04',
    category: 'outros',
  });
  expect(prisma.monthExpense.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ accessKey: null, source: 'nota' }),
  });
});

it('rejects a short access key and a calendar-impossible date', async () => {
  const prisma = { monthExpense: { create: vi.fn() } } as any;
  const svc = new GastosService(prisma);
  await expect(
    svc.confirmNota('co_1', {
      accessKey: '123',
      merchant: 'Padaria',
      amountCents: 1990,
      spentOn: '2026-10-04',
      category: 'mercado',
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
  await expect(
    svc.confirmNota('co_1', {
      merchant: 'Padaria',
      amountCents: 1990,
      spentOn: '2026-02-31',
      category: 'mercado',
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(prisma.monthExpense.create).not.toHaveBeenCalled();
});

it('does not insert the same access key twice for one company', async () => {
  const prisma = { monthExpense: { create: vi.fn().mockRejectedValue({ code: 'P2002' }) } } as any;
  const svc = new GastosService(prisma);
  await expect(
    svc.confirmNota('co_1', {
      accessKey: SP_KEY,
      merchant: 'Padaria',
      amountCents: 1990,
      spentOn: '2026-10-04',
      category: 'outros',
    }),
  ).rejects.toBeInstanceOf(ConflictException);
});

it('lists only the company rows inside the current São Paulo month', async () => {
  const prisma = {
    monthExpense: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'exp_1',
          amountCents: 15000,
          merchant: 'Luz',
          spentOn: new Date('2026-10-04T00:00:00.000Z'),
          source: 'conta',
          category: 'conta_da_casa',
        },
      ]),
    },
  } as any;
  const svc = new GastosService(prisma);
  const view = await svc.listMonth('co_1', new Date('2026-10-04T15:00:00.000Z'));
  expect(prisma.monthExpense.findMany).toHaveBeenCalledWith({
    where: {
      companyId: 'co_1',
      spentOn: {
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lt: new Date('2026-11-01T00:00:00.000Z'),
      },
    },
    orderBy: [{ spentOn: 'asc' }, { createdAt: 'asc' }],
  });
  expect(view).toEqual({
    month: '2026-10',
    expenses: [
      {
        id: 'exp_1',
        amountCents: 15000,
        merchant: 'Luz',
        spentOn: '2026-10-04',
        source: 'conta',
        category: 'conta_da_casa',
      },
    ],
  });
});
