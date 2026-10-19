import { Injectable } from '@nestjs/common';
import { classifyMerchant, isFixedRepeat } from '../expenses/classify';
import { HouseholdService } from '../household/household.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseCsv } from './parse-csv';
import { parseOfx } from './parse-ofx';
import { parsePdf } from './parse-pdf';
import {
  StatementFormatError,
  type ParsedStatementRow,
} from './statement.errors';

@Injectable()
export class StatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly household: HouseholdService,
  ) {}

  async importFile(companyId: string, filename: string, bytes: Buffer) {
    const { householdId } = await this.household.requireMembership(companyId);
    const format = formatFromFilename(filename);
    const rows = await this.parseBytes(format, bytes);

    const statement = await this.prisma.statement.create({
      data: {
        householdId,
        addedByCompanyId: companyId,
        filename,
        format,
      },
    });

    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      if (!isUsableRow(row)) {
        skipped += 1;
        continue;
      }

      const previous = await this.prisma.expense.findFirst({
        where: {
          householdId,
          merchant: { equals: row.merchant, mode: 'insensitive' },
        },
        orderBy: { spentOn: 'desc' },
      });
      const fixed = previous
        ? isFixedRepeat(previous.amountCents, row.amountCents)
        : false;

      await this.prisma.expense.create({
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

async function pdfBufferToText(bytes: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  const result = await parser.getText();
  return result.text;
}
