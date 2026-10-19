import { ExpenseInvalidError, ExpenseNotFoundError } from './expense.errors';
import { ExpensesService } from './expenses.service';

const households = {
  requireMembership: vi.fn().mockResolvedValue({ householdId: 'h1', role: 'member' }),
};
function membership(prisma: { householdMember?: unknown }, householdId: string) {
  households.requireMembership.mockResolvedValue({ householdId, role: 'member' });
}
function fakePrisma() {
  return {
    expense: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    personName: { findMany: vi.fn() },
  };
}

describe('ExpensesService', () => {
  it('lists the group and attaches the adder name', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.findMany.mockResolvedValue([{
      id: 'e1', spentOn: new Date('2026-10-12T00:00:00Z'), merchant: 'Uber',
      category: 'transport', fixed: false, amountCents: 1050, addedByCompanyId: 'co_bia',
    }]);
    prisma.personName.findMany.mockResolvedValue([
      { companyId: 'co_bia', displayName: 'Bia', fullName: 'Bia Souza' },
    ]);
    const svc = new ExpensesService(prisma as never, households as never);
    const rows = await svc.list('co_ana', '2026-10');
    expect(rows[0].addedBy).toEqual({ displayName: 'Bia', initials: 'BS' });
    expect(rows[0].date).toBe('2026-10-12');
  });

  it('creates a manual expense for the group', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.create.mockResolvedValue({
      id: 'e2', spentOn: new Date('2026-10-12T00:00:00Z'), merchant: 'Padaria',
      category: 'groceries', fixed: false, amountCents: 18740, addedByCompanyId: 'co_ana',
    });
    prisma.personName.findMany.mockResolvedValue([]);
    const svc = new ExpensesService(prisma as never, households as never);
    const row = await svc.create('co_ana', {
      merchant: 'Padaria', amountCents: 18740, spentOn: '2026-10-12', category: 'groceries',
    });
    expect(row.merchant).toBe('Padaria');
    expect(prisma.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ householdId: 'h1', amountCents: 18740, category: 'groceries' }),
    });
  });

  it('rejects an expense without amount', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    const svc = new ExpensesService(prisma as never, households as never);
    await expect(svc.create('co_ana', { merchant: 'Padaria', amountCents: 0, spentOn: '2026-10-12', category: 'groceries' }))
      .rejects.toBeInstanceOf(ExpenseInvalidError);
  });

  it('does not patch an expense outside the group', async () => {
    const prisma = fakePrisma();
    membership(prisma, 'h1');
    prisma.expense.findFirst.mockResolvedValue(null);
    const svc = new ExpensesService(prisma as never, households as never);
    await expect(svc.patch('co_ana', 'e_other', { fixed: true })).rejects.toBeInstanceOf(ExpenseNotFoundError);
  });
});
