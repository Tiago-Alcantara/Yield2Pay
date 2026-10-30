import { Injectable } from '@nestjs/common';
import type { ExpenseCategory } from '@yield2pay/shared';
import { HouseholdService } from '../household/household.service';
import { HouseholdNotFoundError } from '../household/household.errors';
import { PrismaService } from '../prisma/prisma.service';
import { saoPauloToday, summarize } from './summary.math';

@Injectable()
export class SummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly household: HouseholdService,
  ) {}

  async summary(companyId: string, month: string) {
    const { householdId } = await this.household.requireMembership(companyId);
    const profile = await this.prisma.household.findUnique({
      where: { id: householdId },
    });
    if (!profile) {
      throw new HouseholdNotFoundError();
    }

    const today = saoPauloToday(new Date());
    const todayMonth = today.slice(0, 7);
    const chartStart = utcMonthStart(month, -5);
    const closedStart = utcMonthStart(todayMonth, -5);
    const chartEnd = utcMonthStart(month, 1);
    const todayEnd = utcMonthStart(todayMonth, 1);
    const [rows, first] = await Promise.all([
      this.prisma.expense.findMany({
        where: {
          householdId,
          spentOn: {
            gte: chartStart < closedStart ? chartStart : closedStart,
            lt: chartEnd > todayEnd ? chartEnd : todayEnd,
          },
        },
      }),
      this.prisma.expense.findFirst({
        where: { householdId },
        orderBy: { spentOn: 'asc' },
        select: { spentOn: true },
      }),
    ]);

    return summarize({
      month,
      today,
      firstExpenseMonth: first
        ? first.spentOn.toISOString().slice(0, 7)
        : null,
      expenses: rows.map((row) => ({
        spentOn: row.spentOn.toISOString().slice(0, 10),
        merchant: row.merchant,
        category: row.category as ExpenseCategory,
        fixed: row.fixed,
        amountCents: row.amountCents,
      })),
      incomeCents: profile.monthlyIncomeCents,
      reserveCents: profile.reserveCents,
      goalMonths: profile.goalMonths,
    });
  }
}

function utcMonthStart(month: string, delta: number): Date {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return new Date(Date.UTC(Math.floor(index / 12), index % 12, 1));
}
