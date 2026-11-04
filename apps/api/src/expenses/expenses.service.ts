import { Injectable } from '@nestjs/common';
import type {
  ExpenseCategory,
  ExpenseKind,
  ExpensePage,
  ExpenseView,
} from '@yield2pay/shared';
import type { ActiveMembership } from '../auth/authenticated-request';
import { initialsOf } from '../household/household.service';
import { PrismaService } from '../prisma/prisma.service';
import { saoPauloToday } from '../summary/summary.math';
import { merchantKey } from './classify';
import { ExpenseInvalidError, ExpenseNotFoundError } from './expense.errors';
import {
  fixedForRead,
  loadExpenseGroup,
  loadLegacyFixedIds,
  lockExpenseGroups,
  planExpenseWrite,
  writeExpensePlan,
} from './fixed-flags';
import {
  isCalendarDay,
  isExpenseKind,
  type ExpensePageQuery,
} from './page-query';

type PatchExpense = {
  kind?: ExpenseKind;
  category?: ExpenseCategory | null;
  fixed?: boolean;
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES: ExpenseCategory[] = [
  'housing',
  'health',
  'education',
  'subscriptions',
  'groceries',
  'restaurant',
  'transport',
  'shopping',
];

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    membership: ActiveMembership,
    month: string,
    category?: ExpenseCategory,
    page?: ExpensePageQuery,
    range?: { from: string; to: string },
    kind?: ExpenseKind,
  ): Promise<ExpensePage> {
    const { limit, offset, cursor } = readPage(page);
    const { householdId } = membership;
    const { gte, lt } = range
      ? utcDayRange(range.from, range.to)
      : utcMonthRange(requireMonth(month));
    const base = {
      householdId,
      spentOn: { gte, lt },
      ...(category ? { category } : {}),
      ...(kind ? { kind } : {}),
    };
    const where = cursor ? { AND: [base, cursorClause(cursor)] } : base;
    const [total, expenses, legacy] = await Promise.all([
      this.prisma.expense.count({ where: base }),
      this.prisma.expense.findMany({
        where,
        orderBy: [{ spentOn: 'desc' }, { id: 'desc' }],
        take: limit,
        ...(cursor ? {} : { skip: offset }),
      }),
      loadLegacyFixedIds(this.prisma, householdId),
    ]);
    const names = await this.loadNames(
      expenses.map((row) => row.addedByCompanyId),
    );
    const last = expenses[expenses.length - 1];
    const nextCursor =
      last && expenses.length === limit && offset + expenses.length < total
        ? `${utcCalendarDay(last.spentOn)}|${last.id}`
        : null;
    return {
      items: expenses.map((row) =>
        toExpenseView(row, names, fixedForRead(row, legacy)),
      ),
      total,
      nextCursor,
    };
  }

  async months(membership: ActiveMembership) {
    const { householdId } = membership;
    const rows = await this.prisma.$queryRaw<
      Array<{ month: string; amountCents: number }>
    >`
      SELECT to_char(spent_on, 'YYYY-MM') AS month,
             COALESCE(SUM(amount_cents), 0)::int AS "amountCents"
      FROM expenses
      WHERE household_id = ${householdId}
        AND kind = 'expense'
        AND NOT excluded_from_totals
      GROUP BY 1
      ORDER BY 1 DESC
    `;
    return rows.map((row) => ({
      month: row.month,
      amountCents: Number(row.amountCents),
    }));
  }

  async create(
    membership: ActiveMembership,
    body: {
      merchant?: string;
      amountCents?: number;
      spentOn?: string;
      kind?: ExpenseKind;
      category?: ExpenseCategory | null;
    },
  ) {
    const { householdId, companyId } = membership;
    const merchant = body.merchant?.trim() ?? '';
    const kind = body.kind ?? 'expense';
    if (
      !merchant ||
      !Number.isInteger(body.amountCents) ||
      (body.amountCents ?? 0) <= 0 ||
      !body.spentOn ||
      !DAY.test(body.spentOn) ||
      !isExpenseKind(kind) ||
      !isCategoryAllowed(kind, body.category) ||
      body.spentOn > saoPauloToday(new Date())
    ) {
      throw new ExpenseInvalidError(
        body.spentOn && body.spentOn > saoPauloToday(new Date())
          ? 'date is in the future'
          : undefined,
      );
    }
    const amountCents = body.amountCents as number;
    const spentOn = body.spentOn;
    if (kind === 'income') {
      // Entrada não conta para o grupo de fixos: não precisa do cadeado nem do plano.
      const key = merchantKey(merchant);
      const income = await this.prisma.expense.create({
        data: {
          householdId,
          addedByCompanyId: companyId,
          spentOn: new Date(`${spentOn}T00:00:00.000Z`),
          merchant,
          kind,
          category: null,
          fixed: false,
          fixedManual: false,
          merchantKey: key,
          sharedMerchantKey: key,
          amountCents,
        },
      });
      const incomeNames = await this.loadNames([income.addedByCompanyId]);
      return toExpenseView(income, incomeNames, false);
    }
    const category = body.category as ExpenseCategory;
    const created = await this.prisma.$transaction(async (tx) => {
      await lockExpenseGroups(tx, householdId, [merchant]);
      const existing = await loadExpenseGroup(tx, householdId, [merchant]);
      const plan = planExpenseWrite(existing, [
        { merchant, spentOn, amountCents, category },
      ]);
      const drafted = plan.inserts[0];
      const row = await tx.expense.create({
        data: {
          householdId,
          addedByCompanyId: companyId,
          spentOn: new Date(`${spentOn}T00:00:00.000Z`),
          merchant,
          category,
          fixed: drafted?.fixed ?? false,
          fixedManual: false,
          merchantKey: drafted?.merchantKey ?? '',
          sharedMerchantKey: drafted?.sharedMerchantKey ?? '',
          amountCents,
        },
      });
      await writeExpensePlan(tx, householdId, plan);
      return row;
    });
    const names = await this.loadNames([created.addedByCompanyId]);
    return toExpenseView(created, names, created.fixed);
  }

  async patch(membership: ActiveMembership, id: string, body: PatchExpense) {
    const { householdId } = membership;
    if (body.kind !== undefined && !isExpenseKind(body.kind)) {
      throw new ExpenseInvalidError('kind is invalid');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.expense.findFirst({
        where: { id, householdId },
      });
      if (!existing) throw new ExpenseNotFoundError();
      const wasIncome = existing.kind === 'income';
      const nextKind = body.kind ?? (wasIncome ? 'income' : 'expense');
      const changesKind = (nextKind === 'income') !== wasIncome;
      const nextCategory = nextCategoryOf(nextKind, body, existing.category);
      await lockExpenseGroups(tx, householdId, [existing.merchant]);
      const group = await loadExpenseGroup(tx, householdId, [
        existing.merchant,
      ]);
      const others = group.filter((row) => row.id !== existing.id);
      // Quem virou entrada sai do grupo; quem virou gasto entra. Os dois casos
      // recalculam o fixo das outras linhas do mesmo estabelecimento.
      const snapshots =
        nextKind === 'income'
          ? others
          : [
              ...others,
              {
                id: existing.id,
                merchant: existing.merchant,
                spentOn: existing.spentOn,
                amountCents: existing.amountCents,
                merchantKey: existing.merchantKey,
                sharedMerchantKey: existing.sharedMerchantKey,
                excludedFromTotals: existing.excludedFromTotals,
                category: nextCategory,
                fixed: body.fixed ?? (changesKind ? false : existing.fixed),
                fixedManual:
                  body.fixed !== undefined ||
                  (!changesKind && existing.fixedManual),
              },
            ];
      const plan = planExpenseWrite(snapshots, [], true);
      if (body.fixed !== undefined) {
        plan.markFixed = plan.markFixed.filter((item) => item !== existing.id);
        plan.unmarkFixed = plan.unmarkFixed.filter(
          (item) => item !== existing.id,
        );
      }
      const data: {
        kind?: ExpenseKind;
        category?: ExpenseCategory | null;
        fixed?: boolean;
        fixedManual?: boolean;
      } = {};
      if (body.category !== undefined) data.category = nextCategory;
      if (changesKind) {
        data.kind = nextKind;
        data.category = nextCategory;
        data.fixed = false;
        data.fixedManual = false;
      }
      if (body.fixed !== undefined) {
        data.fixed = body.fixed;
        data.fixedManual = true;
      }
      const row = await tx.expense.update({ where: { id: existing.id }, data });
      await writeExpensePlan(tx, householdId, plan);
      if (!changesKind) return row;
      // O plano pode ter marcado esta linha como fixa depois do update acima.
      return (
        (await tx.expense.findFirst({ where: { id, householdId } })) ?? row
      );
    });
    const names = await this.loadNames([updated.addedByCompanyId]);
    return toExpenseView(updated, names, updated.fixed);
  }

  async remove(membership: ActiveMembership, id: string) {
    const { householdId } = membership;
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.expense.findFirst({
        where: { id, householdId },
      });
      if (!existing) throw new ExpenseNotFoundError();
      await lockExpenseGroups(tx, householdId, [existing.merchant]);
      const group = existing.merchant
        ? await loadExpenseGroup(tx, householdId, [existing.merchant])
        : [];
      await tx.expense.delete({ where: { id: existing.id } });
      const plan = planExpenseWrite(
        group.filter((row) => row.id !== existing.id),
        [],
        true,
      );
      await writeExpensePlan(tx, householdId, plan);
    });
  }

  private async loadNames(companyIds: string[]) {
    const ids = [...new Set(companyIds)];
    if (ids.length === 0)
      return [] as {
        companyId: string;
        displayName: string | null;
        fullName: string | null;
      }[];
    return this.prisma.personName.findMany({
      where: { companyId: { in: ids } },
    });
  }
}

/** Entrada não tem categoria; gasto tem uma das categorias conhecidas. */
function isCategoryAllowed(kind: ExpenseKind, category: unknown): boolean {
  if (kind === 'income') return category == null;
  return CATEGORIES.includes(category as ExpenseCategory);
}

/** Categoria depois do patch. Recusa aqui o que o CHECK do banco viraria em 500. */
function nextCategoryOf(
  kind: ExpenseKind,
  body: PatchExpense,
  current: string | null,
): ExpenseCategory | null {
  if (kind === 'income') {
    if (body.category != null || body.fixed !== undefined) {
      throw new ExpenseInvalidError('income has no category or fixed flag');
    }
    return null;
  }
  if (body.category !== undefined) {
    if (!isCategoryAllowed(kind, body.category)) {
      throw new ExpenseInvalidError('category is invalid');
    }
    return body.category;
  }
  // Entrada que vira gasto sem dizer a categoria.
  if (current == null) throw new ExpenseInvalidError('category is required');
  return current as ExpenseCategory;
}

function readPage(page?: ExpensePageQuery) {
  const limit = page?.limit ?? 100;
  const offset = page?.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
    throw new ExpenseInvalidError('limit is invalid');
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) {
    throw new ExpenseInvalidError('offset is invalid');
  }
  return { limit, offset, cursor: page?.cursor };
}

function requireMonth(month: string) {
  if (!MONTH.test(month)) {
    throw new ExpenseInvalidError('month is invalid');
  }
  return month;
}

function cursorClause(cursor: string) {
  const match = /^(\d{4}-\d{2}-\d{2})\|([^|]+)$/.exec(cursor);
  if (!match || !isCalendarDay(match[1] ?? '')) {
    throw new ExpenseInvalidError('cursor is invalid');
  }
  const spentOn = new Date(`${match[1]}T00:00:00.000Z`);
  const id = match[2] ?? '';
  return {
    OR: [
      { spentOn: { lt: spentOn } },
      { AND: [{ spentOn }, { id: { lt: id } }] },
    ],
  };
}

function utcDayRange(from: string, to: string) {
  if (!DAY.test(from) || !DAY.test(to)) {
    throw new ExpenseInvalidError('range is invalid');
  }
  const [start, end] = from <= to ? [from, to] : [to, from];
  const [year, month, day] = end.split('-').map(Number);
  return {
    gte: new Date(`${start}T00:00:00.000Z`),
    lt: new Date(Date.UTC(year, month - 1, day + 1)),
  };
}

function utcMonthRange(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return {
    gte: new Date(Date.UTC(year, monthIndex - 1, 1)),
    lt: new Date(Date.UTC(year, monthIndex, 1)),
  };
}

function utcCalendarDay(spentOn: Date) {
  return spentOn.toISOString().slice(0, 10);
}

function toExpenseView(
  row: {
    id: string;
    spentOn: Date;
    merchant: string;
    kind: string;
    category: string | null;
    fixed: boolean;
    amountCents: number;
    excludedFromTotals: boolean;
    addedByCompanyId: string;
  },
  names: {
    companyId: string;
    displayName: string | null;
    fullName: string | null;
  }[],
  fixed = row.fixed,
): ExpenseView {
  const person = names.find((name) => name.companyId === row.addedByCompanyId);
  return {
    id: row.id,
    date: utcCalendarDay(row.spentOn),
    merchant: row.merchant,
    kind: row.kind as ExpenseKind,
    category: row.category as ExpenseCategory | null,
    fixed,
    amountCents: row.amountCents,
    excludedFromTotals: row.excludedFromTotals,
    addedBy: {
      displayName: person?.displayName?.trim() || 'Membro',
      initials: person ? initialsOf(person.fullName, person.displayName) : '?',
    },
  };
}
