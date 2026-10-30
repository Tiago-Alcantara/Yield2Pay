import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ExpenseCategory,
  ExpensePage,
  ExpenseView,
} from '@yield2pay/shared';
import { HouseholdService, initialsOf } from '../household/household.service';
import { PrismaService } from '../prisma/prisma.service';
import { saoPauloToday } from '../summary/summary.math';
import { ExpenseInvalidError, ExpenseNotFoundError } from './expense.errors';
import {
  GROUP_SELECT,
  expenseGroupWhere,
  fixedForRead,
  loadLegacyFixedIds,
  planExpenseWrite,
  writeExpensePlan,
  type ExpenseSnapshot,
} from './fixed-flags';
import type { ExpensePageQuery } from './page-query';

type PatchExpense = {
  category?: ExpenseCategory;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly household: HouseholdService,
  ) {}

  async list(
    companyId: string,
    month: string,
    category?: ExpenseCategory,
    page?: ExpensePageQuery,
    range?: { from: string; to: string },
  ): Promise<ExpensePage> {
    const { limit, offset, cursor } = readPage(page);
    const { householdId } = await this.household.requireMembership(companyId);
    const { gte, lt } = range
      ? utcDayRange(range.from, range.to)
      : utcMonthRange(requireMonth(month));
    const base = {
      householdId,
      spentOn: { gte, lt },
      ...(category ? { category } : {}),
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

  async months(companyId: string) {
    const { householdId } = await this.household.requireMembership(companyId);
    const rows = await this.prisma.$queryRaw<
      Array<{ month: string; amountCents: number }>
    >`
      SELECT to_char(spent_on, 'YYYY-MM') AS month,
             COALESCE(SUM(amount_cents), 0)::int AS "amountCents"
      FROM expenses
      WHERE household_id = ${householdId}
      GROUP BY 1
      ORDER BY 1 DESC
    `;
    return rows.map((row) => ({
      month: row.month,
      amountCents: Number(row.amountCents),
    }));
  }

  async create(
    companyId: string,
    body: {
      merchant?: string;
      amountCents?: number;
      spentOn?: string;
      category?: ExpenseCategory;
    },
  ) {
    const { householdId } = await this.household.requireMembership(companyId);
    const merchant = body.merchant?.trim() ?? '';
    if (
      !merchant ||
      !Number.isInteger(body.amountCents) ||
      (body.amountCents ?? 0) <= 0 ||
      !body.spentOn ||
      !DAY.test(body.spentOn) ||
      !body.category ||
      !CATEGORIES.includes(body.category) ||
      body.spentOn > saoPauloToday(new Date())
    ) {
      throw new ExpenseInvalidError(
        body.spentOn && body.spentOn > saoPauloToday(new Date())
          ? 'date is in the future'
          : undefined,
      );
    }
    const amountCents = body.amountCents as number;
    const category = body.category;
    const spentOn = body.spentOn;
    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await this.loadGroup(tx, householdId, [merchant]);
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
      await writeExpensePlan(tx, plan);
      return row;
    });
    const names = await this.loadNames([created.addedByCompanyId]);
    return toExpenseView(created, names, created.fixed);
  }

  async patch(companyId: string, id: string, body: PatchExpense) {
    const { householdId } = await this.household.requireMembership(companyId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.expense.findFirst({
        where: { id, householdId },
      });
      if (!existing) throw new ExpenseNotFoundError();
      const nextCategory = body.category ?? existing.category;
      const group = await this.loadGroup(tx, householdId, [existing.merchant]);
      const snapshots = group.map((row) =>
        row.id === existing.id
          ? {
              ...row,
              category: nextCategory,
              fixed: body.fixed ?? row.fixed,
              fixedManual:
                body.fixed === true
                  ? true
                  : body.fixed === false
                    ? false
                    : row.fixedManual,
            }
          : row,
      );
      const plan = planExpenseWrite(snapshots, [], true);
      if (body.fixed !== undefined) {
        plan.markFixed = plan.markFixed.filter((item) => item !== existing.id);
        plan.unmarkFixed = plan.unmarkFixed.filter(
          (item) => item !== existing.id,
        );
      }
      const data: {
        category?: ExpenseCategory;
        fixed?: boolean;
        fixedManual?: boolean;
      } = {};
      if (body.category !== undefined) data.category = body.category;
      if (body.fixed !== undefined) {
        data.fixed = body.fixed;
        data.fixedManual = body.fixed === true;
      }
      const row = await tx.expense.update({ where: { id: existing.id }, data });
      await writeExpensePlan(tx, plan);
      return row;
    });
    const names = await this.loadNames([updated.addedByCompanyId]);
    return toExpenseView(updated, names, updated.fixed);
  }

  async remove(companyId: string, id: string) {
    const { householdId } = await this.household.requireMembership(companyId);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.expense.findFirst({
        where: { id, householdId },
      });
      if (!existing) throw new ExpenseNotFoundError();
      const group = existing.merchant
        ? await this.loadGroup(tx, householdId, [existing.merchant])
        : [];
      await tx.expense.delete({ where: { id: existing.id } });
      const plan = planExpenseWrite(
        group.filter((row) => row.id !== existing.id),
        [],
        true,
      );
      await writeExpensePlan(tx, plan);
    });
  }

  private async loadGroup(
    tx: Prisma.TransactionClient,
    householdId: string,
    merchants: string[],
  ): Promise<ExpenseSnapshot[]> {
    const where = expenseGroupWhere(householdId, merchants);
    if (!where) return [];
    const rows = await tx.expense.findMany({
      where,
      select: GROUP_SELECT,
    });
    return rows ?? [];
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
  if (!match) throw new ExpenseInvalidError('cursor is invalid');
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
    category: string;
    fixed: boolean;
    amountCents: number;
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
    category: row.category as ExpenseCategory,
    fixed,
    amountCents: row.amountCents,
    addedBy: {
      displayName: person?.displayName?.trim() || 'Membro',
      initials: person ? initialsOf(person.fullName, person.displayName) : '?',
    },
  };
}
