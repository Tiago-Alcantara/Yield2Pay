import { StatementsService } from './statements.service';

const csv = 'data,descricao,valor\n12/10/2026,Supermercado Dia,10.00\n';

function fakePrisma() {
  return {
    statement: {
      create: vi.fn().mockResolvedValue({ id: 'st1' }),
    },
    expense: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'e1' }),
    },
  };
}

describe('StatementsService', () => {
  it('imports a CSV row as a grocery expense that is not fixed', async () => {
    const prisma = fakePrisma();
    const household = {
      requireMembership: vi.fn().mockResolvedValue({
        householdId: 'h1',
        role: 'owner',
      }),
    };
    const svc = new StatementsService(prisma as never, household as never);

    const result = await svc.importFile('co_1', 'out.csv', Buffer.from(csv));

    expect(household.requireMembership).toHaveBeenCalledWith('co_1');
    expect(prisma.statement.create).toHaveBeenCalledWith({
      data: {
        householdId: 'h1',
        addedByCompanyId: 'co_1',
        filename: 'out.csv',
        format: 'csv',
      },
    });
    expect(prisma.expense.create).toHaveBeenCalledWith({
      data: {
        householdId: 'h1',
        addedByCompanyId: 'co_1',
        statementId: 'st1',
        spentOn: new Date('2026-10-12'),
        merchant: 'Supermercado Dia',
        category: 'groceries',
        fixed: false,
        amountCents: 1000,
      },
    });
    expect(result).toEqual({ statementId: 'st1', imported: 1, skipped: 0 });
  });

  it('marks a repeat merchant within 5 percent as fixed', async () => {
    const prisma = fakePrisma();
    prisma.expense.findFirst.mockResolvedValue({ amountCents: 1000 });
    const household = {
      requireMembership: vi.fn().mockResolvedValue({
        householdId: 'h1',
        role: 'owner',
      }),
    };
    const svc = new StatementsService(prisma as never, household as never);

    await svc.importFile('co_1', 'out.csv', Buffer.from(csv));

    expect(prisma.expense.findFirst).toHaveBeenCalledWith({
      where: {
        householdId: 'h1',
        merchant: { equals: 'Supermercado Dia', mode: 'insensitive' },
      },
      orderBy: { spentOn: 'desc' },
    });
    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fixed: true,
          category: 'groceries',
          addedByCompanyId: 'co_1',
        }),
      }),
    );
  });

  it('skips a CSV row with an empty valor', async () => {
    const csvEmptyValor =
      'data,descricao,valor\n12/10/2026,Supermercado Dia,\n';
    const prisma = fakePrisma();
    const household = {
      requireMembership: vi.fn().mockResolvedValue({
        householdId: 'h1',
        role: 'owner',
      }),
    };
    const svc = new StatementsService(prisma as never, household as never);

    const result = await svc.importFile(
      'co_1',
      'out.csv',
      Buffer.from(csvEmptyValor),
    );

    expect(prisma.expense.create).not.toHaveBeenCalled();
    expect(result).toEqual({ statementId: 'st1', imported: 0, skipped: 1 });
  });
});
