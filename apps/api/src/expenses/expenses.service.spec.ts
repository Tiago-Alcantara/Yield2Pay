/**
 * Módulo: expenses.service
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: Gastos do grupo são listados, criados, reclassificados e apagados sem misturar casas.
 * Sequência: lists the group and attaches the adder name; rejects a month that is not YYYY-MM; pages the month with limit and offset; rejects a limit outside 1 to 200; reads distinct months from the database; deletes an expense that belongs to the group; does not delete an expense outside the group; creates a manual expense for the group; rejects an expense dated after today; lists a custom date range; rejects an expense without amount; does not patch an expense outside the group.
 */
import { ExpenseInvalidError, ExpenseNotFoundError } from './expense.errors';
import { ExpensesService } from './expenses.service';

const households = {
  requireMembership: vi
    .fn()
    .mockResolvedValue({ householdId: 'h1', role: 'member' }),
};
function membership(_prisma: unknown, householdId: string) {
  households.requireMembership.mockResolvedValue({
    householdId,
    role: 'member',
  });
}
function fakePrisma() {
  const prisma = {
    expense: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
    },
    personName: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
      work(prisma),
    ),
  };
  return prisma;
}

describe('ExpensesService', () => {
  it('lists the group and attaches the adder name', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.findMany.mockResolvedValue([
      {
        id: 'e1',
        spentOn: new Date('2026-10-12T00:00:00Z'),
        merchant: 'Uber',
        category: 'transport',
        fixed: false,
        amountCents: 1050,
        addedByCompanyId: 'co_bia',
      },
    ]);
    prisma.personName.findMany.mockResolvedValue([
      { companyId: 'co_bia', displayName: 'Bia', fullName: 'Bia Souza' },
    ]);
    const svc = new ExpensesService(prisma as never, households as never);
    const page = await svc.list('co_ana', '2026-10');
    expect(prisma.expense.updateMany).not.toHaveBeenCalled();
    expect(page.total).toBe(1);
    expect(page.items[0].addedBy).toEqual({
      displayName: 'Bia',
      initials: 'B',
    });
    expect(page.items[0].date).toBe('2026-10-12');
  });

  it('rejects a month that is not YYYY-MM', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.findMany.mockResolvedValue([]);
    const svc = new ExpensesService(prisma as never, households as never);
    await expect(svc.list('co_ana', '2026-13')).rejects.toThrow(
      'month is invalid',
    );
  });

  it('pages the month with limit and offset', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.count.mockResolvedValue(120);
    prisma.expense.findMany.mockResolvedValue([]);
    prisma.personName.findMany.mockResolvedValue([]);
    const svc = new ExpensesService(prisma as never, households as never);
    const page = await svc.list('co_ana', '2026-10', undefined, {
      limit: 50,
      offset: 100,
    });
    expect(page.total).toBe(120);
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 100 }),
    );
  });

  it('rejects a limit outside 1 to 5000', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    const svc = new ExpensesService(prisma as never, households as never);
    await expect(
      svc.list('co_ana', '2026-10', undefined, { limit: 0, offset: 0 }),
    ).rejects.toThrow('limit is invalid');
    await expect(
      svc.list('co_ana', '2026-10', undefined, { limit: 5001, offset: 0 }),
    ).rejects.toThrow('limit is invalid');
  });

  it('reads distinct months from the database', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([
      { month: '2026-10', amountCents: 15000 },
      { month: '2026-09', amountCents: 4000 },
    ]);
    const svc = new ExpensesService(prisma as never, households as never);
    const months = await svc.months('co_ana');
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
    expect(months).toEqual([
      { month: '2026-10', amountCents: 15000 },
      { month: '2026-09', amountCents: 4000 },
    ]);
  });

  it('deletes an expense that belongs to the group', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.findFirst.mockResolvedValue({ id: 'e1' });
    const svc = new ExpensesService(prisma as never, households as never);
    await svc.remove('co_ana', 'e1');
    expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
  });

  it('does not delete an expense outside the group', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.findFirst.mockResolvedValue(null);
    const svc = new ExpensesService(prisma as never, households as never);
    await expect(svc.remove('co_ana', 'e_other')).rejects.toBeInstanceOf(
      ExpenseNotFoundError,
    );
  });

  it('creates a manual expense for the group', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.create.mockResolvedValue({
      id: 'e2',
      spentOn: new Date('2026-10-12T00:00:00Z'),
      merchant: 'Padaria',
      category: 'groceries',
      fixed: false,
      amountCents: 18740,
      addedByCompanyId: 'co_ana',
    });
    prisma.personName.findMany.mockResolvedValue([]);
    const svc = new ExpensesService(prisma as never, households as never);
    const row = await svc.create('co_ana', {
      merchant: 'Padaria',
      amountCents: 18740,
      spentOn: '2026-10-12',
      category: 'groceries',
    });
    expect(row.merchant).toBe('Padaria');
    expect(prisma.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        householdId: 'h1',
        amountCents: 18740,
        category: 'groceries',
      }),
    });
  });

  it('marks the earlier rent fixed when the next month is created', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.findMany.mockResolvedValue([
      {
        id: 'rent',
        merchant: 'Aluguel',
        spentOn: new Date('2026-09-05T00:00:00.000Z'),
        amountCents: 250000,
        category: 'housing',
        fixed: false,
        sharedMerchantKey: 'aluguel',
      },
    ]);
    prisma.expense.create.mockResolvedValue({
      id: 'rent2',
      spentOn: new Date('2026-10-05T00:00:00.000Z'),
      merchant: 'Aluguel',
      category: 'housing',
      fixed: true,
      amountCents: 250000,
      addedByCompanyId: 'co_ana',
    });
    prisma.personName.findMany.mockResolvedValue([]);
    const svc = new ExpensesService(prisma as never, households as never);
    const row = await svc.create('co_ana', {
      merchant: 'Aluguel',
      amountCents: 250000,
      spentOn: '2026-10-05',
      category: 'housing',
    });
    expect(row.fixed).toBe(true);
    expect(prisma.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fixed: true,
        merchantKey: 'aluguel',
        sharedMerchantKey: 'aluguel',
      }),
    });
    expect(prisma.expense.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['rent'] } },
      data: { fixed: true },
    });
  });

  it('rejects an expense dated after today', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    const svc = new ExpensesService(prisma as never, households as never);
    await expect(
      svc.create('co_ana', {
        merchant: 'Padaria',
        amountCents: 1000,
        spentOn: '2099-01-01',
        category: 'groceries',
      }),
    ).rejects.toThrow('date is in the future');
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it('lists a custom date range', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.findMany.mockResolvedValue([]);
    prisma.personName.findMany.mockResolvedValue([]);
    const svc = new ExpensesService(prisma as never, households as never);
    await svc.list('co_ana', '', undefined, undefined, {
      from: '2026-08-01',
      to: '2026-11-30',
    });
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spentOn: {
            gte: new Date('2026-08-01T00:00:00.000Z'),
            lt: new Date('2026-12-01T00:00:00.000Z'),
          },
        }),
      }),
    );
  });

  it('rejects an expense without amount', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    const svc = new ExpensesService(prisma as never, households as never);
    await expect(
      svc.create('co_ana', {
        merchant: 'Padaria',
        amountCents: 0,
        spentOn: '2026-10-12',
        category: 'groceries',
      }),
    ).rejects.toBeInstanceOf(ExpenseInvalidError);
  });

  it('does not patch an expense outside the group', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.findFirst.mockResolvedValue(null);
    const svc = new ExpensesService(prisma as never, households as never);
    await expect(
      svc.patch('co_ana', 'e_other', { fixed: true }),
    ).rejects.toBeInstanceOf(ExpenseNotFoundError);
  });

  it('reads only the merchant group inside one transaction', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.findMany.mockResolvedValue([]);
    prisma.expense.create.mockResolvedValue({
      id: 'e2',
      spentOn: new Date('2026-10-12T00:00:00Z'),
      merchant: 'Padaria',
      category: 'groceries',
      fixed: false,
      amountCents: 1000,
      addedByCompanyId: 'co_ana',
    });
    prisma.personName.findMany.mockResolvedValue([]);
    const svc = new ExpensesService(prisma as never, households as never);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        svc.create('co_ana', {
          merchant: 'Padaria',
          amountCents: 1000,
          spentOn: '2026-10-12',
          category: 'groceries',
        }),
      ),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(10);
    expect(prisma.expense.findMany).toHaveBeenCalledTimes(10);
    for (const [args] of prisma.expense.findMany.mock.calls) {
      expect(args.where.householdId).toBe('h1');
      expect(JSON.stringify(args.where)).toContain('padaria');
      expect(args.where).not.toEqual({ householdId: 'h1' });
    }
  });

  it('unmarks the remaining rent when the second month is removed', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    const rent = {
      id: 'rent',
      merchant: 'Aluguel',
      spentOn: new Date('2026-09-05T00:00:00.000Z'),
      amountCents: 250000,
      category: 'housing',
      fixed: true,
      fixedManual: false,
      merchantKey: 'aluguel',
      sharedMerchantKey: 'aluguel',
    };
    prisma.expense.findFirst.mockResolvedValue({
      ...rent,
      id: 'rent2',
      spentOn: new Date('2026-10-05T00:00:00.000Z'),
    });
    prisma.expense.findMany.mockResolvedValue([
      rent,
      { ...rent, id: 'rent2', spentOn: new Date('2026-10-05T00:00:00.000Z') },
    ]);
    const svc = new ExpensesService(prisma as never, households as never);
    await svc.remove('co_ana', 'rent2');
    expect(prisma.expense.delete).toHaveBeenCalledWith({
      where: { id: 'rent2' },
    });
    expect(prisma.expense.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['rent'] }, fixedManual: false },
      data: { fixed: false },
    });
  });

  it('keeps a hand-marked fixed expense when the group is recomputed', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    const rent = {
      id: 'rent',
      merchant: 'Aluguel',
      spentOn: new Date('2026-10-05T00:00:00.000Z'),
      amountCents: 250000,
      category: 'housing',
      fixed: true,
      fixedManual: true,
      merchantKey: 'aluguel',
      sharedMerchantKey: 'aluguel',
      addedByCompanyId: 'co_ana',
    };
    prisma.expense.findFirst.mockResolvedValue(rent);
    prisma.expense.findMany.mockResolvedValue([rent]);
    prisma.expense.update.mockResolvedValue({ ...rent, category: 'shopping' });
    prisma.personName.findMany.mockResolvedValue([]);
    const svc = new ExpensesService(prisma as never, households as never);
    const row = await svc.patch('co_ana', 'rent', { category: 'shopping' });
    expect(row.fixed).toBe(true);
    expect(prisma.expense.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { fixed: false } }),
    );
  });

  it('shows the fixed flag for old rows that have no merchant key', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    const october = {
      id: 'b',
      merchant: 'Aluguel',
      spentOn: new Date('2026-10-05T00:00:00.000Z'),
      amountCents: 250000,
      category: 'housing',
      fixed: false,
      merchantKey: '',
      addedByCompanyId: 'co_ana',
    };
    prisma.expense.findFirst.mockResolvedValue({ id: 'probe' });
    prisma.expense.count.mockResolvedValue(1);
    prisma.expense.findMany.mockImplementation(
      (args: { where?: { merchantKey?: string } }) => {
        if (args?.where?.merchantKey === '') {
          return [
            {
              id: 'a',
              merchant: 'Aluguel',
              spentOn: new Date('2026-09-05T00:00:00.000Z'),
              amountCents: 250000,
              category: 'housing',
            },
            {
              id: 'b',
              merchant: 'Aluguel',
              spentOn: new Date('2026-10-05T00:00:00.000Z'),
              amountCents: 250000,
              category: 'housing',
            },
          ];
        }
        return [october];
      },
    );
    prisma.personName.findMany.mockResolvedValue([]);
    const svc = new ExpensesService(prisma as never, households as never);
    const page = await svc.list('co_ana', '2026-10');
    expect(page.items[0]?.fixed).toBe(true);
    expect(prisma.expense.updateMany).not.toHaveBeenCalled();
  });

  it('pages with a cursor instead of skipping rows', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.count.mockResolvedValue(2);
    prisma.expense.findMany.mockResolvedValue([]);
    prisma.personName.findMany.mockResolvedValue([]);
    const svc = new ExpensesService(prisma as never, households as never);
    await svc.list('co_ana', '2026-10', undefined, {
      limit: 1,
      offset: 0,
      cursor: '2026-10-12|e9',
    });
    const args = prisma.expense.findMany.mock.calls[0][0];
    expect(args.skip).toBeUndefined();
    expect(args.orderBy).toEqual([{ spentOn: 'desc' }, { id: 'desc' }]);
    expect(JSON.stringify(args.where)).toContain('e9');
  });
});
