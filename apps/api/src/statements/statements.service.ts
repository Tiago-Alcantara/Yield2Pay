import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { classifyMerchant, idsToMarkFixed } from '../expenses/classify';
import { HouseholdService } from '../household/household.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseCsv } from './parse-csv';
import { decodeOfx, parseOfx } from './parse-ofx';
import { parsePdf } from './parse-pdf';
import {
  StatementDuplicateError,
  StatementFormatError,
  StatementNotFoundError,
  StatementTooLargeError,
  type ParsedStatementRow,
} from './statement.errors';

const MAX_STATEMENT_BYTES = 5 * 1024 * 1024;

@Injectable()
export class StatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly household: HouseholdService,
  ) {}

  async importFile(companyId: string, filename: string, bytes: Buffer) {
    if (bytes.length === 0) {
      throw new StatementFormatError();
    }
    if (bytes.length > MAX_STATEMENT_BYTES) {
      throw new StatementTooLargeError();
    }

    const { householdId } = await this.household.requireMembership(companyId);
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const duplicate = await this.prisma.statement.findFirst({
      where: { householdId, contentHash },
      select: { id: true },
    });
    if (duplicate) {
      throw new StatementDuplicateError();
    }

    const format = formatFromFilename(filename);
    const rows = await this.parseBytes(format, bytes);
    const hasDebit = rows.some((row) => row.signed === 'debit');
    const debits = rows.filter((row) => isUsableRow(row) && !isIncome(row, format, hasDebit));
    const incomes = rows.filter((row) => isUsableRow(row) && isIncome(row, format, hasDebit));
    if (debits.length === 0 && incomes.length === 0) {
      throw new StatementFormatError();
    }
    if (debits.length === 0) {
      return { statementId: '', imported: 0, skipped: rows.length };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const statement = await tx.statement.create({
          data: {
            householdId,
            addedByCompanyId: companyId,
            filename,
            format,
            contentHash,
          },
        });

        let imported = 0;
        let skipped = rows.length - debits.length;
        const merchants: string[] = [];
        for (const row of debits) {
          if (row.fitId) {
            const existing = await tx.expense.findFirst({
              where: { householdId, fitId: row.fitId },
              select: { id: true },
            });
            if (existing) {
              skipped += 1;
              continue;
            }
          }

          const category = classifyMerchant(row.merchant);
          await tx.expense.create({
            data: {
              householdId,
              addedByCompanyId: companyId,
              statementId: statement.id,
              spentOn: new Date(row.spentOn),
              merchant: row.merchant,
              category,
              fixed: false,
              amountCents: row.amountCents,
              ...(row.fitId ? { fitId: row.fitId } : {}),
            },
          });
          merchants.push(row.merchant);
          imported += 1;
        }

        if (imported === 0) {
          throw new StatementDuplicateError();
        }

        await markFixedRepeats(tx, householdId, merchants);
        return { statementId: statement.id, imported, skipped };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new StatementDuplicateError();
      }
      throw error;
    }
  }

  async remove(companyId: string, statementId: string) {
    const { householdId } = await this.household.requireMembership(companyId);
    const statement = await this.prisma.statement.findFirst({
      where: { id: statementId, householdId },
      select: { id: true },
    });
    if (!statement) {
      throw new StatementNotFoundError();
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({ where: { statementId, householdId } });
      await tx.statement.delete({ where: { id: statementId } });
    });
  }

  async list(companyId: string) {
    const { householdId } = await this.household.requireMembership(companyId);
    const rows = await this.prisma.statement.findMany({
      where: { householdId },
      orderBy: { importedAt: 'desc' },
      take: 20,
      include: { _count: { select: { expenses: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      importedAt: row.importedAt.toISOString(),
      expenseCount: row._count.expenses,
    }));
  }

  private async parseBytes(
    format: 'csv' | 'ofx' | 'pdf',
    bytes: Buffer,
  ): Promise<ParsedStatementRow[]> {
    if (format === 'csv') {
      return parseCsv(bytes.toString('utf8'));
    }
    if (format === 'ofx') {
      return parseOfx(decodeOfx(bytes));
    }
    const text = await pdfBufferToText(bytes);
    const rows = parsePdf(text);
    if (rows.length === 0) {
      throw new StatementFormatError();
    }
    return rows;
  }
}

function formatFromFilename(filename: string): 'csv' | 'ofx' | 'pdf' {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv' || ext === 'ofx' || ext === 'pdf') {
    return ext;
  }
  throw new StatementFormatError();
}

function isUsableRow(row: ParsedStatementRow): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(row.spentOn) &&
    row.merchant.length > 0 &&
    Number.isFinite(row.amountCents) &&
    row.amountCents > 0
  );
}

function isIncome(row: ParsedStatementRow, format: string, hasDebit: boolean): boolean {
  if (row.signed === 'credit') {
    return true;
  }
  return format === 'csv' && row.signed === 'unsigned' && hasDebit;
}

type ExpenseWriter = {
  expense: {
    findMany: (args: {
      where: { householdId: string };
      select: { id: true; merchant: true; spentOn: true; amountCents: true; category: true };
    }) => Promise<Array<{ id: string; merchant: string; spentOn: Date; amountCents: number; category: string }>>;
    updateMany: (args: {
      where: { id: { in: string[] } };
      data: { fixed: boolean };
    }) => Promise<unknown>;
  };
};

async function markFixedRepeats(
  tx: ExpenseWriter,
  householdId: string,
  merchants: string[],
) {
  void merchants;
  const rows = await tx.expense.findMany({
    where: { householdId },
    select: { id: true, merchant: true, spentOn: true, amountCents: true, category: true },
  });
  const ids = idsToMarkFixed(
    rows.map((row) => ({
      id: row.id,
      merchant: row.merchant,
      spentOn: row.spentOn.toISOString().slice(0, 10),
      amountCents: row.amountCents,
      category: row.category,
    })),
  );
  if (ids.length === 0) return;
  await tx.expense.updateMany({
    where: { id: { in: ids } },
    data: { fixed: true },
  });
}

async function pdfBufferToText(bytes: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  const result = await parser.getText();
  return result.text;
}
