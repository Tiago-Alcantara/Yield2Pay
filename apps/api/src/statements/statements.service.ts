import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { classifyMerchant, isFixedRepeat } from '../expenses/classify';
import { HouseholdService } from '../household/household.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseCsv } from './parse-csv';
import { parseOfx } from './parse-ofx';
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
        let skipped = 0;
        for (const row of rows) {
          if (!isUsableRow(row) || isIncome(row, format, hasDebit)) {
            skipped += 1;
            continue;
          }

          const earlier = await tx.expense.findMany({
            where: {
              householdId,
              merchant: { equals: row.merchant, mode: 'insensitive' },
              spentOn: { lt: monthStartUtc(row.spentOn) },
            },
            select: { amountCents: true },
          });
          const fixed = earlier.some((previous) =>
            isFixedRepeat(previous.amountCents, row.amountCents),
          );

          await tx.expense.create({
            data: {
              householdId,
              addedByCompanyId: companyId,
              statementId: statement.id,
              spentOn: new Date(row.spentOn),
              merchant: row.merchant,
              category: classifyMerchant(row.merchant),
              fixed,
              amountCents: row.amountCents,
            },
          });
          imported += 1;
        }

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

  private async parseBytes(
    format: 'csv' | 'ofx' | 'pdf',
    bytes: Buffer,
  ): Promise<ParsedStatementRow[]> {
    if (format === 'csv') {
      return parseCsv(bytes.toString('utf8'));
    }
    if (format === 'ofx') {
      return parseOfx(bytes.toString('utf8'));
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

function monthStartUtc(spentOn: string): Date {
  const [year, month] = spentOn.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

async function pdfBufferToText(bytes: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  const result = await parser.getText();
  return result.text;
}
