import type { ExpenseCategory, HouseholdSummary } from '@yield2pay/shared';

export interface SummaryExpense {
  spentOn: string;
  merchant: string;
  category: ExpenseCategory;
  fixed: boolean;
  amountCents: number;
}

export interface SummaryInput {
  month: string;
  today: string;
  expenses: SummaryExpense[];
  incomeCents: number | null;
  reserveCents: number | null;
  goalMonths: number | null;
}

export function saoPauloToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function dayOf(spentOn: string): number {
  return Number(spentOn.slice(8, 10));
}

function inMonth(spentOn: string, month: string): boolean {
  return spentOn.slice(0, 7) === month;
}

function sum(expenses: SummaryExpense[]): number {
  return expenses.reduce((total, expense) => total + expense.amountCents, 0);
}

function fullMonth(
  expenses: SummaryExpense[],
  month: string,
): SummaryExpense[] {
  return expenses.filter((expense) => inMonth(expense.spentOn, month));
}

function cumulative(expenses: SummaryExpense[], throughDay: number): number[] {
  const series: number[] = [];
  let running = 0;
  for (let day = 1; day <= throughDay; day += 1) {
    running += sum(
      expenses.filter((expense) => dayOf(expense.spentOn) === day),
    );
    series.push(running);
  }
  return series;
}

export function summarize(input: SummaryInput): HouseholdSummary {
  const { month, today, expenses, incomeCents, reserveCents, goalMonths } =
    input;
  const todayDay = dayOf(today);
  const inProgress = month === today.slice(0, 7);
  const previousMonth = shiftMonth(month, -1);
  const monthExpenses = fullMonth(expenses, month);
  const included = inProgress
    ? monthExpenses.filter((expense) => dayOf(expense.spentOn) <= todayDay)
    : monthExpenses;
  const monthTotalCents = sum(included);

  const previousExpenses = fullMonth(expenses, previousMonth);
  const previousIncluded = inProgress
    ? previousExpenses.filter((expense) => dayOf(expense.spentOn) <= todayDay)
    : previousExpenses;
  const previousComparableCents = sum(previousIncluded);
  const changePercent =
    previousComparableCents === 0
      ? null
      : round1(
          ((monthTotalCents - previousComparableCents) /
            previousComparableCents) *
            100,
        );

  let projectedCents = monthTotalCents;
  if (inProgress) {
    const merchantsThisMonth = new Set(
      monthExpenses.map((expense) => expense.merchant.toLowerCase()),
    );
    const fixedSoFar = sum(included.filter((expense) => expense.fixed));
    const variableSoFar = sum(included.filter((expense) => !expense.fixed));
    const fixedStillToCome = sum(
      previousExpenses.filter(
        (expense) =>
          expense.fixed &&
          dayOf(expense.spentOn) > todayDay &&
          !merchantsThisMonth.has(expense.merchant.toLowerCase()),
      ),
    );
    projectedCents =
      fixedSoFar +
      fixedStillToCome +
      Math.round((variableSoFar / todayDay) * daysInMonth(month));
  }

  const byCategory = [
    ...included.reduce((totals, expense) => {
      totals.set(
        expense.category,
        (totals.get(expense.category) ?? 0) + expense.amountCents,
      );
      return totals;
    }, new Map<ExpenseCategory, number>()),
  ]
    .filter(([, amountCents]) => amountCents !== 0)
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((left, right) => right.amountCents - left.amountCents);

  const lastSix = Array.from({ length: 6 }, (_, index) =>
    shiftMonth(month, index - 5),
  );
  const lastSixMonths = lastSix.map((key) => ({
    month: key,
    amountCents: sum(fullMonth(expenses, key)),
  }));
  const averageCents = Math.round(
    lastSix
      .slice(0, 5)
      .reduce((total, key) => total + sum(fullMonth(expenses, key)), 0) / 5,
  );

  const freedom =
    averageCents === 0 ||
    incomeCents === null ||
    reserveCents === null ||
    goalMonths === null ||
    incomeCents - averageCents === 0
      ? null
      : {
          months: round1(reserveCents / averageCents),
          missingCents: goalMonths * averageCents - reserveCents,
          deadlineMonths: round1(
            (goalMonths * averageCents - reserveCents) /
              (incomeCents - averageCents),
          ),
        };

  return {
    monthTotalCents,
    previousComparableCents,
    changePercent,
    projectedCents,
    leftoverCents: incomeCents === null ? null : incomeCents - projectedCents,
    byCategory,
    lastSixMonths,
    averageCents,
    dailyPace: {
      current: cumulative(
        monthExpenses,
        inProgress ? todayDay : daysInMonth(month),
      ),
      previous: cumulative(previousExpenses, daysInMonth(previousMonth)),
    },
    fixedVsVariable: lastSix.map((key) => {
      const rows = fullMonth(expenses, key);
      return {
        month: key,
        fixedCents: sum(rows.filter((expense) => expense.fixed)),
        variableCents: sum(rows.filter((expense) => !expense.fixed)),
      };
    }),
    freedom,
  };
}
