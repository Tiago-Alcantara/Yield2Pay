import { Injectable } from '@nestjs/common';
import type { ExpenseCategory, ExpensePage, ExpenseView } from '@yield2pay/shared';
import { HouseholdService, initialsOf } from '../household/household.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseInvalidError, ExpenseNotFoundError } from './expense.errors';

type PatchExpense = {
  category?: ExpenseCategory;
  fixed?: boolean;
};

type ExpensePageQuery = {
  limit: number;
  offset: number;
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

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
  ): Promise<ExpensePage> {
    if (!MONTH.test(month)) {
      throw new ExpenseInvalidError('month is invalid');
    }
    const { limit, offset } = readPage(page);
    const { householdId } = await this.household.requireMembership(companyId);
    const { gte, lt } = utcMonthRange(month);
    const where = {
      householdId,
      spentOn: { gte, lt },
      ...(category ? { category } : {}),
    };
    const [total, expenses] = await Promise.all([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        orderBy: { spentOn: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);
    const names = await this.loadNames(
      expenses.map((row) => row.addedByCompanyId),
    );
    return {
      items: expenses.map((row) => toExpenseView(row, names)),
      total,
    };
  }

  async months(companyId: string) {
    const { householdId } = await this.household.requireMembership(companyId);
    const rows = await this.prisma.$queryRaw<Array<{ month: string }>>`
      SELECT to_char(spent_on, 'YYYY-MM') AS month
      FROM expenses
      WHERE household_id = ${householdId}
      GROUP BY 1
      ORDER BY 1 DESC
    `;
    return rows.map((row) => row.month);
  }

  async create(
    companyId: string,
    body: { merchant?: string; amountCents?: number; spentOn?: string; category?: ExpenseCategory },
  ) {
    const { householdId } = await this.household.requireMembership(companyId);
    const merchant = body.merchant?.trim() ?? '';
    const categories: ExpenseCategory[] = [
      'housing', 'health', 'education', 'subscriptions',
      'groceries', 'restaurant', 'transport', 'shopping',
    ];
    if (
      !merchant
      || !Number.isInteger(body.amountCents)
      || (body.amountCents ?? 0) <= 0
      || !body.spentOn
      || !/^\d{4}-\d{2}-\d{2}$/.test(body.spentOn)
      || !body.category
      || !categories.includes(body.category)
    ) {
      throw new ExpenseInvalidError();
    }
    const created = await this.prisma.expense.create({
      data: {
        householdId,
        addedByCompanyId: companyId,
        spentOn: new Date(`${body.spentOn}T00:00:00.000Z`),
        merchant,
        category: body.category,
        fixed: false,
        amountCents: body.amountCents as number,
      },
    });
    const names = await this.loadNames([created.addedByCompanyId]);
    return toExpenseView(created, names);
  }

  async patch(companyId: string, id: string, body: PatchExpense) {
    const { householdId } = await this.household.requireMembership(companyId);
    const existing = await this.prisma.expense.findFirst({
      where: { id, householdId },
    });
    if (!existing) {
      throw new ExpenseNotFoundError();
    }
    const data: { category?: ExpenseCategory; fixed?: boolean } = {};
    if (body.category !== undefined) data.category = body.category;
    if (body.fixed !== undefined) data.fixed = body.fixed;
    const updated = await this.prisma.expense.update({
      where: { id: existing.id },
      data,
    });
    const names = await this.loadNames([updated.addedByCompanyId]);
    return toExpenseView(updated, names);
  }

  async remove(companyId: string, id: string) {
    const { householdId } = await this.household.requireMembership(companyId);
    const existing = await this.prisma.expense.findFirst({
      where: { id, householdId },
      select: { id: true },
    });
    if (!existing) {
      throw new ExpenseNotFoundError();
    }
    await this.prisma.expense.delete({ where: { id: existing.id } });
  }

  private async loadNames(companyIds: string[]) {
    const ids = [...new Set(companyIds)];
    if (ids.length === 0) return [] as { companyId: string; displayName: string | null; fullName: string | null }[];
    return this.prisma.personName.findMany({
      where: { companyId: { in: ids } },
    });
  }
}

function readPage(page?: ExpensePageQuery) {
  const limit = page?.limit ?? DEFAULT_LIMIT;
  const offset = page?.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new ExpenseInvalidError('limit is invalid');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ExpenseInvalidError('offset is invalid');
  }
  return { limit, offset };
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
  names: { companyId: string; displayName: string | null; fullName: string | null }[],
): ExpenseView {
  const person = names.find((name) => name.companyId === row.addedByCompanyId);
  return {
    id: row.id,
    date: utcCalendarDay(row.spentOn),
    merchant: row.merchant,
    category: row.category as ExpenseCategory,
    fixed: row.fixed,
    amountCents: row.amountCents,
    addedBy: {
      displayName: person?.displayName?.trim() || 'Membro',
      initials: person
        ? initialsOf(person.fullName, person.displayName)
        : '?',
    },
  };
}
