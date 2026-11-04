import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ExpenseKind, StatementPreview } from '@yield2pay/shared';
import type { ActiveMembership } from '../auth/authenticated-request';
import { classifyMerchant, merchantKey } from '../expenses/classify';
import {
  GROUP_SELECT,
  loadExpenseGroup,
  lockExpenseGroups,
  planExpenseWrite,
  writeExpensePlan,
} from '../expenses/fixed-flags';
import { isExpenseKind } from '../expenses/page-query';
import { PrismaService } from '../prisma/prisma.service';
import { parseCsv } from './parse-csv';
import { decodeOfx, parseOfx } from './parse-ofx';
import { parsePdf } from './parse-pdf';
import {
  StatementDuplicateError,
  StatementFormatError,
  StatementNotFoundError,
  StatementTooLargeError,
  type AmountSign,
  type ParsedStatementRow,
} from './statement.errors';

const MAX_STATEMENT_BYTES = 5 * 1024 * 1024;

type KindedRow = ParsedStatementRow & { kind: ExpenseKind };

@Injectable()
export class StatementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lê o arquivo e mostra o que entraria, com o tipo sugerido. Não grava nada. */
  async preview(
    membership: ActiveMembership,
    filename: string,
    bytes: Buffer,
  ): Promise<StatementPreview> {
    const { householdId } = membership;
    const { rows } = await this.readNewStatement(householdId, filename, bytes);
    const usable = rows.filter(isUsableRow);
    if (usable.length === 0) {
      throw new StatementFormatError();
    }
    const known = await this.knownFitIds(this.prisma, householdId, usable);
    return {
      filename,
      skipped: rows.length - usable.length,
      rows: usable.map((row, index) => ({
        index,
        date: row.spentOn,
        merchant: row.merchant,
        amountCents: row.amountCents,
        kind: kindFromSign(row.signed),
        alreadyImported: Boolean(row.fitId && known.has(row.fitId)),
      })),
    };
  }

  /**
   * Grava o extrato. Com kinds, grava cada linha da prévia com o tipo escolhido.
   * Sem kinds (quem ainda não usa a prévia), só os débitos entram.
   */
  async importFile(
    membership: ActiveMembership,
    filename: string,
    bytes: Buffer,
    kinds?: ExpenseKind[],
  ) {
    const { householdId, companyId } = membership;
    const { format, contentHash, rows } = await this.readNewStatement(
      householdId,
      filename,
      bytes,
    );
    const chosen = kinds
      ? rowsWithChosenKinds(rows, kinds)
      : rowsWithoutPreview(rows, format);
    if (chosen === 'no-usable-row') {
      throw new StatementFormatError();
    }
    if (chosen.length === 0) {
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

        const knownFits = await this.knownFitIds(tx, householdId, chosen);
        let skipped = rows.length - chosen.length;
        const fresh: KindedRow[] = [];
        for (const row of chosen) {
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

        // Só o gasto passa pelo grupo de fixos. A entrada não conta para ele.
        const spending = fresh.filter((row) => row.kind === 'expense');
        const income = fresh.filter((row) => row.kind === 'income');
        const merchants = spending.map((row) => row.merchant);
        await lockExpenseGroups(tx, householdId, merchants);
        const existing = await loadExpenseGroup(tx, householdId, merchants);
        const plan = planExpenseWrite(
          existing,
          spending.map((row) => ({
            merchant: row.merchant,
            spentOn: row.spentOn,
            amountCents: row.amountCents,
            category: classifyMerchant(row.merchant),
          })),
        );
        const common = {
          householdId,
          addedByCompanyId: companyId,
          statementId: statement.id,
          source: 'statement',
        };
        await tx.expense.createMany({
          data: [
            ...plan.inserts.map((row, index) => ({
              ...common,
              spentOn: new Date(row.spentOn),
              merchant: row.merchant,
              kind: 'expense',
              category: row.category,
              fixed: row.fixed,
              amountCents: row.amountCents,
              merchantKey: row.merchantKey,
              sharedMerchantKey: row.sharedMerchantKey,
              ...(spending[index]?.fitId
                ? { fitId: spending[index].fitId }
                : {}),
            })),
            ...income.map((row) => {
              const key = merchantKey(row.merchant);
              return {
                ...common,
                spentOn: new Date(row.spentOn),
                merchant: row.merchant,
                kind: 'income',
                category: null,
                fixed: false,
                amountCents: row.amountCents,
                merchantKey: key,
                sharedMerchantKey: key,
                ...(row.fitId ? { fitId: row.fitId } : {}),
              };
            }),
          ],
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

  /** Validação comum da prévia e da confirmação. Só lê do banco. */
  private async readNewStatement(
    householdId: string,
    filename: string,
    bytes: Buffer,
  ) {
    if (bytes.length === 0) {
      throw new StatementFormatError();
    }
    if (bytes.length > MAX_STATEMENT_BYTES) {
      throw new StatementTooLargeError();
    }
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
    return { format, contentHash, rows };
  }

  private async knownFitIds(
    db: Pick<Prisma.TransactionClient, 'expense'>,
    householdId: string,
    rows: ParsedStatementRow[],
  ): Promise<Set<string>> {
    const fitIds = [
      ...new Set(rows.flatMap((row) => (row.fitId ? [row.fitId] : []))),
    ];
    const known = new Set<string>();
    if (fitIds.length === 0) return known;
    const found = await db.expense.findMany({
      where: { householdId, fitId: { in: fitIds } },
      select: { fitId: true },
    });
    for (const row of found) {
      if (row.fitId) known.add(row.fitId);
    }
    return known;
  }

  async remove(membership: ActiveMembership, statementId: string) {
    const { householdId } = membership;
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

  async list(membership: ActiveMembership) {
    const { householdId } = membership;
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

/** Crédito é entrada. Débito e valor sem sinal (CSV e PDF) são gasto. */
export function kindFromSign(signed: AmountSign): ExpenseKind {
  return signed === 'credit' ? 'income' : 'expense';
}

/** O campo kinds da confirmação: JSON com um tipo por linha da prévia. */
export function parseStatementKinds(raw: unknown): ExpenseKind[] | undefined {
  if (raw == null || raw === '') return undefined;
  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : null;
  } catch {
    throw new StatementFormatError('kinds is invalid');
  }
  if (!Array.isArray(parsed) || !parsed.every(isExpenseKind)) {
    throw new StatementFormatError('kinds is invalid');
  }
  return parsed;
}

function rowsWithChosenKinds(
  rows: ParsedStatementRow[],
  kinds: ExpenseKind[],
): KindedRow[] | 'no-usable-row' {
  const usable = rows.filter(isUsableRow);
  if (usable.length === 0) return 'no-usable-row';
  if (usable.length !== kinds.length) {
    throw new StatementFormatError('kinds does not match the file');
  }
  return usable.map((row, index) => ({
    ...row,
    kind: kinds[index] ?? kindFromSign(row.signed),
  }));
}

/** Importação direta, sem prévia: entrada de dinheiro fica de fora, como sempre foi. */
function rowsWithoutPreview(
  rows: ParsedStatementRow[],
  format: string,
): KindedRow[] | 'no-usable-row' {
  const hasDebit = rows.some((row) => row.signed === 'debit');
  const usable = rows.filter(isUsableRow);
  if (usable.length === 0) return 'no-usable-row';
  return usable
    .filter((row) => !isIncome(row, format, hasDebit))
    .map((row) => ({ ...row, kind: 'expense' as const }));
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
