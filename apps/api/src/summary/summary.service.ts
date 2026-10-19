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

    const rows = await this.prisma.expense.findMany({
      where: {
        householdId,
        spentOn: {
          gte: utcMonthStart(month, -6),
          lt: utcMonthStart(month, 1),
        },
      },
    });

    return summarize({
      month,
      today: saoPauloToday(new Date()),
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
