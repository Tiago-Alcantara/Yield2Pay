import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { classifyMerchant } from '../expenses/classify';
import {
  GROUP_SELECT,
  loadExpenseGroup,
  lockExpenseGroups,
  planExpenseWrite,
  writeExpensePlan,
} from '../expenses/fixed-flags';
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
    const debits = rows.filter(
      (row) => isUsableRow(row) && !isIncome(row, format, hasDebit),
    );
    const incomes = rows.filter(
      (row) => isUsableRow(row) && isIncome(row, format, hasDebit),
    );
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

        const fitIds = [
          ...new Set(debits.flatMap((row) => (row.fitId ? [row.fitId] : []))),
        ];
        const knownFits = new Set<string>();
        if (fitIds.length > 0) {
          const found = await tx.expense.findMany({
            where: { householdId, fitId: { in: fitIds } },
            select: { fitId: true },
          });
          for (const row of found) {
            if (row.fitId) knownFits.add(row.fitId);
          }
        }

        let skipped = rows.length - debits.length;
        const fresh: ParsedStatementRow[] = [];
        for (const row of debits) {
          if (row.fitId && knownFits.has(row.fitId)) {
            skipped += 1;
            continue;
          }
          if (row.fitId) knownFits.add(row.fitId);
          fresh.push(row);
        }
        if (fresh.length === 0) {
          throw new StatementDuplicateError();
        }

        const merchants = fresh.map((row) => row.merchant);
        await lockExpenseGroups(tx, householdId, merchants);
        const existing = await loadExpenseGroup(tx, householdId, merchants);
        const plan = planExpenseWrite(
          existing,
          fresh.map((row) => ({
            merchant: row.merchant,
            spentOn: row.spentOn,
            amountCents: row.amountCents,
            category: classifyMerchant(row.merchant),
          })),
        );
        await tx.expense.createMany({
          data: plan.inserts.map((row, index) => ({
            householdId,
            addedByCompanyId: companyId,
            statementId: statement.id,
            spentOn: new Date(row.spentOn),
            merchant: row.merchant,
            category: row.category,
            fixed: row.fixed,
            amountCents: row.amountCents,
            merchantKey: row.merchantKey,
            sharedMerchantKey: row.sharedMerchantKey,
            ...(fresh[index]?.fitId ? { fitId: fresh[index].fitId } : {}),
          })),
        });
        await writeExpensePlan(tx, householdId, plan);
        return { statementId: statement.id, imported: fresh.length, skipped };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
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
      const doomed = await tx.expense.findMany({
        where: { statementId, householdId },
        select: GROUP_SELECT,
      });
      const merchants = [...new Set(doomed.map((row) => row.merchant))];
      await lockExpenseGroups(tx, householdId, merchants);
      await tx.expense.deleteMany({ where: { statementId, householdId } });
      await tx.statement.delete({ where: { id: statementId } });
      if (merchants.length === 0) return;
      const remaining = await loadExpenseGroup(tx, householdId, merchants);
      await writeExpensePlan(
        tx,
        householdId,
        planExpenseWrite(remaining, [], true),
      );
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

function isIncome(
  row: ParsedStatementRow,
  format: string,
  hasDebit: boolean,
): boolean {
  if (row.signed === 'credit') {
    return true;
  }
  return format === 'csv' && row.signed === 'unsigned' && hasDebit;
}

async function pdfBufferToText(bytes: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: bytes });
  const result = await parser.getText();
  return result.text;
}
