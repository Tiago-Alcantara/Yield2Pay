/**
 * Módulo: statements.service
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: A importação grava o extrato uma vez e não duplica o mesmo arquivo.
 * Sequência: imports a CSV row as a grocery expense that is not fixed; marks a merchant fixed when it repeats across months; skips an OFX row whose FITID was already imported; rejects an OFX file with no usable transaction; skips a CSV row with an empty valor; rejects a file larger than 5 MB; rejects a file whose contents were already imported; skips income when the file also has debits; deletes a statement and the expenses that came from it; does not delete a statement from another household.
 */
import { createHash } from 'crypto';
import { StatementsService } from './statements.service';

const csv = 'data,descricao,valor\n12/10/2026,Supermercado Dia,10.00\n';

function fakePrisma() {
  const prisma = {
    statement: {
      create: vi.fn().mockResolvedValue({ id: 'st1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({ id: 'st1' }),
    },
    expense: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'e1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(prisma)),
  };
  return prisma;
}

function contentHash(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
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
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.statement.create).toHaveBeenCalledWith({
      data: {
        householdId: 'h1',
        addedByCompanyId: 'co_1',
        filename: 'out.csv',
        format: 'csv',
        contentHash: contentHash(Buffer.from(csv)),
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

  it('marks a merchant fixed when it repeats across months', async () => {
    const repeating = 'data,descricao,valor\n01/09/2026,Netflix,55.90\n01/10/2026,Netflix,55.90\n';
    const prisma = fakePrisma();
    prisma.expense.findMany.mockResolvedValue([
      { id: 'a', merchant: 'NETFLIX.COM', spentOn: new Date('2026-09-01T00:00:00.000Z'), amountCents: 5590, category: 'subscriptions' },
      { id: 'b', merchant: 'Netflix', spentOn: new Date('2026-10-01T00:00:00.000Z'), amountCents: 5590, category: 'subscriptions' },
    ]);
    const household = {
      requireMembership: vi.fn().mockResolvedValue({
        householdId: 'h1',
        role: 'owner',
      }),
    };
    const svc = new StatementsService(prisma as never, household as never);

    await svc.importFile('co_1', 'netflix.csv', Buffer.from(repeating));

    expect(prisma.expense.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
      data: { fixed: true },
    });
  });

  it('skips an OFX row whose FITID was already imported', async () => {
    const ofx = '<STMTTRN><DTPOSTED>20261012</DTPOSTED><TRNAMT>-10.00</TRNAMT><NAME>Uber</NAME><FITID>fit-1</FITID></STMTTRN>';
    const prisma = fakePrisma();
    prisma.expense.findFirst.mockResolvedValue({ id: 'already' });
    const household = {
      requireMembership: vi.fn().mockResolvedValue({ householdId: 'h1', role: 'owner' }),
    };
    const svc = new StatementsService(prisma as never, household as never);

    await expect(svc.importFile('co_1', 'banco.ofx', Buffer.from(ofx))).rejects.toThrow(
      'statement already imported',
    );
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it('rejects an OFX file with no usable transaction', async () => {
    const prisma = fakePrisma();
    const household = {
      requireMembership: vi.fn().mockResolvedValue({ householdId: 'h1', role: 'owner' }),
    };
    const svc = new StatementsService(prisma as never, household as never);

    await expect(
      svc.importFile('co_1', 'quebrado.ofx', Buffer.from('<STMTTRN><FOO>x</FOO></STMTTRN>')),
    ).rejects.toThrow('Invalid statement file');
    expect(prisma.statement.create).not.toHaveBeenCalled();
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

    await expect(
      svc.importFile('co_1', 'out.csv', Buffer.from(csvEmptyValor)),
    ).rejects.toThrow('Invalid statement file');

    expect(prisma.expense.create).not.toHaveBeenCalled();
    expect(prisma.statement.create).not.toHaveBeenCalled();
  });

  it('rejects a file larger than 5 MB', async () => {
    const prisma = fakePrisma();
    const household = {
      requireMembership: vi.fn().mockResolvedValue({ householdId: 'h1', role: 'owner' }),
    };
    const svc = new StatementsService(prisma as never, household as never);

    await expect(
      svc.importFile('co_1', 'out.csv', Buffer.alloc(5 * 1024 * 1024 + 1)),
    ).rejects.toThrow('file is too large');
    expect(prisma.statement.create).not.toHaveBeenCalled();
  });

  it('rejects a file whose contents were already imported', async () => {
    const prisma = fakePrisma();
    prisma.statement.findFirst.mockResolvedValue({ id: 'st-old' });
    const household = {
      requireMembership: vi.fn().mockResolvedValue({ householdId: 'h1', role: 'owner' }),
    };
    const svc = new StatementsService(prisma as never, household as never);

    await expect(svc.importFile('co_1', 'out.csv', Buffer.from(csv))).rejects.toThrow(
      'statement already imported',
    );
    expect(prisma.statement.create).not.toHaveBeenCalled();
  });

  it('skips income when the file also has debits', async () => {
    const mixed = 'data,descricao,valor\n01/10/2026,Salario,3500.00\n12/10/2026,Padaria,-18.90\n';
    const prisma = fakePrisma();
    const household = {
      requireMembership: vi.fn().mockResolvedValue({ householdId: 'h1', role: 'owner' }),
    };
    const svc = new StatementsService(prisma as never, household as never);

    const result = await svc.importFile('co_1', 'nubank.csv', Buffer.from(mixed));

    expect(result).toEqual({ statementId: 'st1', imported: 1, skipped: 1 });
    expect(prisma.expense.create).toHaveBeenCalledTimes(1);
    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          merchant: 'Padaria',
          category: 'groceries',
          amountCents: 1890,
          fixed: false,
        }),
      }),
    );
  });

  it('deletes a statement and the expenses that came from it', async () => {
    const prisma = fakePrisma();
    prisma.statement.findFirst.mockResolvedValue({ id: 'st1', householdId: 'h1' });
    const household = {
      requireMembership: vi.fn().mockResolvedValue({ householdId: 'h1', role: 'owner' }),
    };
    const svc = new StatementsService(prisma as never, household as never);

    await svc.remove('co_1', 'st1');

    expect(prisma.expense.deleteMany).toHaveBeenCalledWith({
      where: { statementId: 'st1', householdId: 'h1' },
    });
    expect(prisma.statement.delete).toHaveBeenCalledWith({ where: { id: 'st1' } });
  });

  it('does not delete a statement from another household', async () => {
    const prisma = fakePrisma();
    prisma.statement.findFirst.mockResolvedValue(null);
    const household = {
      requireMembership: vi.fn().mockResolvedValue({ householdId: 'h1', role: 'owner' }),
    };
    const svc = new StatementsService(prisma as never, household as never);

    await expect(svc.remove('co_1', 'st-other')).rejects.toThrow('statement not found');
    expect(prisma.statement.delete).not.toHaveBeenCalled();
  });
});
