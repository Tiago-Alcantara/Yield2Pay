/**
 * Módulo: statements.service
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: A importação grava o extrato uma vez e não duplica o mesmo arquivo.
 * Sequência: imports a CSV row as a grocery expense that is not fixed; marks a merchant fixed when it repeats across months; skips an OFX row whose FITID was already imported; rejects an OFX file with no usable transaction; skips a CSV row with an empty valor; rejects a file larger than 5 MB; rejects a file whose contents were already imported; skips income when the file also has debits; deletes a statement and the expenses that came from it; does not delete a statement from another household; a prévia aplica o sinal de OFX, CSV e PDF sem gravar; a confirmação grava o tipo escolhido em cada linha.
 */
import { createHash } from 'crypto';
import type { ActiveMembership } from '../auth/authenticated-request';
import { StatementFormatError } from './statement.errors';
import { parseStatementKinds, StatementsService } from './statements.service';

const pdfText = vi.hoisted(() => ({ value: '' }));
vi.mock('pdf-parse', () => ({
  PDFParse: class {
    getText() {
      return Promise.resolve({ text: pdfText.value });
    }
  },
}));

// Grupo ativo que o HouseholdMemberGuard entregaria ao controller.
const ownerMembership: ActiveMembership = {
  householdId: 'h1',
  companyId: 'co_1',
  role: 'owner',
  personal: true,
};

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
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
      work(prisma),
    ),
  };
  return prisma;
}

function contentHash(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('StatementsService', () => {
  it('imports a CSV row as a grocery expense that is not fixed', async () => {
    const prisma = fakePrisma();
    const svc = new StatementsService(prisma as never);

    const result = await svc.importFile(
      ownerMembership,
      'out.csv',
      Buffer.from(csv),
    );

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
    expect(prisma.expense.createMany).toHaveBeenCalledWith({
      data: [
        {
          householdId: 'h1',
          addedByCompanyId: 'co_1',
          statementId: 'st1',
          source: 'statement',
          spentOn: new Date('2026-10-12'),
          merchant: 'Supermercado Dia',
          kind: 'expense',
          category: 'groceries',
          fixed: false,
          amountCents: 1000,
          merchantKey: 'supermercado dia',
          sharedMerchantKey: 'supermercado dia',
        },
      ],
    });
    expect(result).toEqual({ statementId: 'st1', imported: 1, skipped: 0 });
  });

  it('marks a merchant fixed when it repeats across months', async () => {
    const repeating =
      'data,descricao,valor\n01/09/2026,Netflix,55.90\n01/10/2026,Netflix,55.90\n';
    const prisma = fakePrisma();
    prisma.expense.findMany.mockResolvedValue([
      {
        id: 'a',
        merchant: 'NETFLIX.COM',
        spentOn: new Date('2026-09-01T00:00:00.000Z'),
        amountCents: 5590,
        category: 'subscriptions',
      },
      {
        id: 'b',
        merchant: 'Netflix',
        spentOn: new Date('2026-10-01T00:00:00.000Z'),
        amountCents: 5590,
        category: 'subscriptions',
      },
    ]);
    const svc = new StatementsService(prisma as never);

    await svc.importFile(
      ownerMembership,
      'netflix.csv',
      Buffer.from(repeating),
    );

    expect(prisma.expense.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, householdId: 'h1', fixedManual: false },
      data: { fixed: true },
    });
  });

  it('skips an OFX row whose FITID was already imported', async () => {
    const ofx =
      '<STMTTRN><DTPOSTED>20261012</DTPOSTED><TRNAMT>-10.00</TRNAMT><NAME>Uber</NAME><FITID>fit-1</FITID></STMTTRN>';
    const prisma = fakePrisma();
    prisma.expense.findMany.mockResolvedValue([{ fitId: 'fit-1' }]);
    const svc = new StatementsService(prisma as never);

    await expect(
      svc.importFile(ownerMembership, 'banco.ofx', Buffer.from(ofx)),
    ).rejects.toThrow('statement already imported');
    expect(prisma.expense.createMany).not.toHaveBeenCalled();
  });

  it('rejects an OFX file with no usable transaction', async () => {
    const prisma = fakePrisma();
    const svc = new StatementsService(prisma as never);

    await expect(
      svc.importFile(
        ownerMembership,
        'quebrado.ofx',
        Buffer.from('<STMTTRN><FOO>x</FOO></STMTTRN>'),
      ),
    ).rejects.toThrow('Invalid statement file');
    expect(prisma.statement.create).not.toHaveBeenCalled();
  });

  it('skips a CSV row with an empty valor', async () => {
    const csvEmptyValor =
      'data,descricao,valor\n12/10/2026,Supermercado Dia,\n';
    const prisma = fakePrisma();
    const svc = new StatementsService(prisma as never);

    await expect(
      svc.importFile(ownerMembership, 'out.csv', Buffer.from(csvEmptyValor)),
    ).rejects.toThrow('Invalid statement file');

    expect(prisma.expense.createMany).not.toHaveBeenCalled();
    expect(prisma.statement.create).not.toHaveBeenCalled();
  });

  it('rejects a file larger than 5 MB', async () => {
    const prisma = fakePrisma();
    const svc = new StatementsService(prisma as never);

    await expect(
      svc.importFile(
        ownerMembership,
        'out.csv',
        Buffer.alloc(5 * 1024 * 1024 + 1),
      ),
    ).rejects.toThrow('file is too large');
    expect(prisma.statement.create).not.toHaveBeenCalled();
  });

  it('rejects a file whose contents were already imported', async () => {
    const prisma = fakePrisma();
    prisma.statement.findFirst.mockResolvedValue({ id: 'st-old' });
    const svc = new StatementsService(prisma as never);

    await expect(
      svc.importFile(ownerMembership, 'out.csv', Buffer.from(csv)),
    ).rejects.toThrow('statement already imported');
    expect(prisma.statement.create).not.toHaveBeenCalled();
  });

  it('skips income when the file also has debits', async () => {
    const mixed =
      'data,descricao,valor\n01/10/2026,Salario,3500.00\n12/10/2026,Padaria,-18.90\n';
    const prisma = fakePrisma();
    const svc = new StatementsService(prisma as never);

    const result = await svc.importFile(
      ownerMembership,
      'nubank.csv',
      Buffer.from(mixed),
    );

    expect(result).toEqual({ statementId: 'st1', imported: 1, skipped: 1 });
    expect(prisma.expense.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.expense.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            merchant: 'Padaria',
            category: 'groceries',
            amountCents: 1890,
            fixed: false,
          }),
        ],
      }),
    );
  });

  it('deletes a statement and the expenses that came from it', async () => {
    const prisma = fakePrisma();
    prisma.statement.findFirst.mockResolvedValue({
      id: 'st1',
      householdId: 'h1',
    });
    const svc = new StatementsService(prisma as never);

    await svc.remove(ownerMembership, 'st1');

    expect(prisma.expense.deleteMany).toHaveBeenCalledWith({
      where: { statementId: 'st1', householdId: 'h1' },
    });
    expect(prisma.statement.delete).toHaveBeenCalledWith({
      where: { id: 'st1' },
    });
  });

  it('does not delete a statement from another household', async () => {
    const prisma = fakePrisma();
    prisma.statement.findFirst.mockResolvedValue(null);
    const svc = new StatementsService(prisma as never);

    await expect(svc.remove(ownerMembership, 'st-other')).rejects.toThrow(
      'statement not found',
    );
    expect(prisma.statement.delete).not.toHaveBeenCalled();
  });

  describe('prévia do extrato', () => {
    function expectNothingWritten(prisma: ReturnType<typeof fakePrisma>) {
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.statement.create).not.toHaveBeenCalled();
      expect(prisma.statement.delete).not.toHaveBeenCalled();
      expect(prisma.expense.create).not.toHaveBeenCalled();
      expect(prisma.expense.createMany).not.toHaveBeenCalled();
      expect(prisma.expense.updateMany).not.toHaveBeenCalled();
      expect(prisma.expense.deleteMany).not.toHaveBeenCalled();
    }

    const ofx = [
      '<STMTTRN><DTPOSTED>20261001</DTPOSTED><TRNAMT>3500.00</TRNAMT><NAME>Salario</NAME><FITID>fit-1</FITID></STMTTRN>',
      '<STMTTRN><DTPOSTED>20261012</DTPOSTED><TRNAMT>-10.00</TRNAMT><NAME>Uber</NAME><FITID>fit-2</FITID></STMTTRN>',
      '<STMTTRN><DTPOSTED>20261013</DTPOSTED><TRNAMT>+20.00</TRNAMT><NAME>Pix recebido</NAME><FITID>fit-3</FITID></STMTTRN>',
    ].join('');
    const signedCsv =
      'data,descricao,valor\n01/10/2026,Salario,"+3.500,00"\n12/10/2026,Padaria,"-18,90"\n13/10/2026,Farmacia,"20,00"\n';

    it('OFX: crédito vira entrada, débito vira gasto, e nada é gravado', async () => {
      const prisma = fakePrisma();
      const svc = new StatementsService(prisma as never);

      const result = await svc.preview(
        ownerMembership,
        'banco.ofx',
        Buffer.from(ofx),
      );

      expect(result).toEqual({
        filename: 'banco.ofx',
        skipped: 0,
        rows: [
          {
            index: 0,
            date: '2026-10-01',
            merchant: 'Salario',
            amountCents: 350000,
            kind: 'income',
            alreadyImported: false,
          },
          {
            index: 1,
            date: '2026-10-12',
            merchant: 'Uber',
            amountCents: 1000,
            kind: 'expense',
            alreadyImported: false,
          },
          {
            index: 2,
            date: '2026-10-13',
            merchant: 'Pix recebido',
            amountCents: 2000,
            kind: 'income',
            alreadyImported: false,
          },
        ],
      });
      expectNothingWritten(prisma);
    });

    it('CSV: o sinal manda, e o valor sem sinal vem como gasto mesmo com débitos no arquivo', async () => {
      const prisma = fakePrisma();
      const svc = new StatementsService(prisma as never);

      const result = await svc.preview(
        ownerMembership,
        'nubank.csv',
        Buffer.from(signedCsv),
      );

      expect(result.rows.map((row) => [row.merchant, row.kind])).toEqual([
        ['Salario', 'income'],
        ['Padaria', 'expense'],
        ['Farmacia', 'expense'],
      ]);
      expectNothingWritten(prisma);
    });

    it('PDF: o sinal manda, e o valor sem sinal vem como gasto', async () => {
      pdfText.value = [
        '01/10/2026 Salario +3.500,00',
        '12/10/2026 Padaria Estrela -45,90',
        '13/10/2026 Enel R$ 89,90',
        'linha que não é lançamento',
      ].join('\n');
      const prisma = fakePrisma();
      const svc = new StatementsService(prisma as never);

      const result = await svc.preview(
        ownerMembership,
        'extrato.pdf',
        Buffer.from('%PDF-falso'),
      );

      expect(
        result.rows.map((row) => [row.merchant, row.amountCents, row.kind]),
      ).toEqual([
        ['Salario', 350000, 'income'],
        ['Padaria Estrela', 4590, 'expense'],
        ['Enel', 8990, 'expense'],
      ]);
      expectNothingWritten(prisma);
    });

    it('conta as linhas que não deu para ler e marca o FITID já importado', async () => {
      const csvWithBlank =
        'data,descricao,valor\n12/10/2026,Padaria,"-18,90"\n13/10/2026,Sem valor,\n';
      const prisma = fakePrisma();
      const svc = new StatementsService(prisma as never);
      const blank = await svc.preview(
        ownerMembership,
        'a.csv',
        Buffer.from(csvWithBlank),
      );
      expect(blank.skipped).toBe(1);
      expect(blank.rows).toHaveLength(1);

      prisma.expense.findMany.mockResolvedValue([{ fitId: 'fit-2' }]);
      const known = await svc.preview(
        ownerMembership,
        'banco.ofx',
        Buffer.from(ofx),
      );
      expect(known.rows.map((row) => row.alreadyImported)).toEqual([
        false,
        true,
        false,
      ]);
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: {
          householdId: 'h1',
          fitId: { in: ['fit-1', 'fit-2', 'fit-3'] },
        },
        select: { fitId: true },
      });
      expectNothingWritten(prisma);
    });

    it('recusa como a importação: repetido, grande demais e sem linha válida', async () => {
      const prisma = fakePrisma();
      const svc = new StatementsService(prisma as never);
      await expect(
        svc.preview(
          ownerMembership,
          'a.csv',
          Buffer.alloc(5 * 1024 * 1024 + 1),
        ),
      ).rejects.toThrow('file is too large');
      await expect(
        svc.preview(
          ownerMembership,
          'a.csv',
          Buffer.from('data,descricao,valor\n12/10/2026,Sem valor,\n'),
        ),
      ).rejects.toThrow('Invalid statement file');
      prisma.statement.findFirst.mockResolvedValue({ id: 'st-old' });
      await expect(
        svc.preview(ownerMembership, 'a.csv', Buffer.from(signedCsv)),
      ).rejects.toThrow('statement already imported');
      expectNothingWritten(prisma);
    });
  });

  describe('confirmação com o tipo de cada linha', () => {
    const csvThree =
      'data,descricao,valor\n01/10/2026,Salario,"+3.500,00"\n12/10/2026,Padaria,"-18,90"\n13/10/2026,Reembolso,"20,00"\n';

    function writtenRows(prisma: ReturnType<typeof fakePrisma>) {
      return prisma.expense.createMany.mock.calls[0]?.[0].data as Array<
        Record<string, unknown>
      >;
    }

    it('grava cada linha com o tipo escolhido, sem categoria na entrada', async () => {
      const prisma = fakePrisma();
      const svc = new StatementsService(prisma as never);

      const result = await svc.importFile(
        ownerMembership,
        'nubank.csv',
        Buffer.from(csvThree),
        ['income', 'expense', 'income'],
      );

      expect(result).toEqual({ statementId: 'st1', imported: 3, skipped: 0 });
      const rows = writtenRows(prisma);
      expect(rows).toHaveLength(3);
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            merchant: 'Padaria',
            kind: 'expense',
            category: 'groceries',
            source: 'statement',
          }),
          expect.objectContaining({
            merchant: 'Salario',
            kind: 'income',
            category: null,
            fixed: false,
            source: 'statement',
            statementId: 'st1',
            merchantKey: 'salario',
            sharedMerchantKey: 'salario',
          }),
          expect.objectContaining({
            merchant: 'Reembolso',
            kind: 'income',
            category: null,
          }),
        ]),
      );
    });

    it('a pessoa pode trocar o que a prévia sugeriu', async () => {
      const prisma = fakePrisma();
      const svc = new StatementsService(prisma as never);

      await svc.importFile(
        ownerMembership,
        'nubank.csv',
        Buffer.from(csvThree),
        ['expense', 'income', 'expense'],
      );

      const byMerchant = new Map(
        writtenRows(prisma).map((row) => [row.merchant, row]),
      );
      expect(byMerchant.get('Salario')).toMatchObject({
        kind: 'expense',
        category: 'shopping',
      });
      expect(byMerchant.get('Padaria')).toMatchObject({
        kind: 'income',
        category: null,
      });
    });

    it('um extrato só de entradas também é gravado, sem mexer nos fixos', async () => {
      const prisma = fakePrisma();
      const svc = new StatementsService(prisma as never);

      const result = await svc.importFile(
        ownerMembership,
        'nubank.csv',
        Buffer.from(csvThree),
        ['income', 'income', 'income'],
      );

      expect(result.imported).toBe(3);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.expense.updateMany).not.toHaveBeenCalled();
    });

    it('o FITID já importado é pulado também na entrada', async () => {
      const ofxTwo =
        '<STMTTRN><DTPOSTED>20261001</DTPOSTED><TRNAMT>3500.00</TRNAMT><NAME>Salario</NAME><FITID>fit-1</FITID></STMTTRN>' +
        '<STMTTRN><DTPOSTED>20261012</DTPOSTED><TRNAMT>-10.00</TRNAMT><NAME>Uber</NAME><FITID>fit-2</FITID></STMTTRN>';
      const prisma = fakePrisma();
      prisma.expense.findMany.mockImplementation(
        (args: { where: { fitId?: unknown } }) =>
          Promise.resolve(args.where.fitId ? [{ fitId: 'fit-1' }] : []),
      );
      const svc = new StatementsService(prisma as never);

      const result = await svc.importFile(
        ownerMembership,
        'banco.ofx',
        Buffer.from(ofxTwo),
        ['income', 'expense'],
      );

      expect(result).toEqual({ statementId: 'st1', imported: 1, skipped: 1 });
      expect(writtenRows(prisma).map((row) => row.fitId)).toEqual(['fit-2']);
    });

    it('recusa kinds que não batem com o arquivo, sem gravar', async () => {
      const prisma = fakePrisma();
      const svc = new StatementsService(prisma as never);

      await expect(
        svc.importFile(ownerMembership, 'nubank.csv', Buffer.from(csvThree), [
          'income',
        ]),
      ).rejects.toThrow('kinds does not match the file');
      expect(prisma.statement.create).not.toHaveBeenCalled();
    });

    it.each([
      ['{"0":"income"}'],
      ['["income","transfer"]'],
      ['não é json'],
      [['income']],
      [7],
    ])('o campo kinds %j é inválido', (raw) => {
      expect(() => parseStatementKinds(raw)).toThrow(StatementFormatError);
    });

    it('sem o campo kinds, segue a importação sem prévia', () => {
      expect(parseStatementKinds(undefined)).toBeUndefined();
      expect(parseStatementKinds('')).toBeUndefined();
      expect(parseStatementKinds('["income","expense"]')).toEqual([
        'income',
        'expense',
      ]);
    });
  });
});
