/**
 * Módulo: summary.math
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: O resumo do mês soma gastos, reserva e o dia de hoje em São Paulo.
 * Sequência: projects an in-progress October when this month already has Aluguel; adds September rent still to come when October has no matching merchant; treats a lowercased merchant as already present this month; averages May through September and fills freedom; uses full-month totals for a closed month; rounds change to one decimal and leaves freedom null without a usable average; returns null freedom when the five prior months are empty; keeps days after today out of the partial total; returns null freedom when income equals the five-month average; ignores months before the first expense and keeps freedom on today; formats the America/Sao_Paulo calendar date.
 */
import type { ExpenseCategory } from '@yield2pay/shared';
import { saoPauloToday, summarize, type SummaryExpense } from './summary.math';

const TODAY = '2026-10-12';
const INCOME = 500000;
const RESERVE = 100000;
const GOAL = 12;

function expense(
  spentOn: string,
  amountCents: number,
  fixed: boolean,
  merchant = 'Mercado',
  category: ExpenseCategory = fixed ? 'housing' : 'groceries',
): SummaryExpense {
  return { spentOn, merchant, category, fixed, amountCents };
}

const octoberWithRent: SummaryExpense[] = [
  expense('2026-10-02', 10000, true, 'Aluguel'),
  expense('2026-10-10', 5000, false),
];

const septemberRent: SummaryExpense[] = [
  expense('2026-09-20', 10000, true, 'Aluguel'),
];

describe('summarize', () => {
  it('projects an in-progress October when this month already has Aluguel', () => {
    const result = summarize({
      month: '2026-10',
      today: TODAY,
      expenses: [...octoberWithRent, ...septemberRent],
      incomeCents: INCOME,
      reserveCents: RESERVE,
      goalMonths: GOAL,
    });

    expect(result.monthTotalCents).toBe(15000);
    expect(result.projectedCents).toBe(10000 + Math.round((5000 / 12) * 31));
    expect(result.changePercent).toBeNull();
    expect(result.previousComparableCents).toBe(0);
    expect(result.leftoverCents).toBe(INCOME - result.projectedCents);
    expect(result.averageCents).toBe(10000);
    expect(result.freedom).toEqual({
      months: 10,
      missingCents: 12 * 10000 - 100000,
      deadlineMonths: 0,
    });
    expect(result.byCategory).toEqual([
      { category: 'housing', amountCents: 10000 },
      { category: 'groceries', amountCents: 5000 },
    ]);
    expect(result.lastSixMonths).toEqual([
      { month: '2026-05', amountCents: 0 },
      { month: '2026-06', amountCents: 0 },
      { month: '2026-07', amountCents: 0 },
      { month: '2026-08', amountCents: 0 },
      { month: '2026-09', amountCents: 10000 },
      { month: '2026-10', amountCents: 15000 },
    ]);
    expect(result.dailyPace.current).toHaveLength(12);
    expect(result.dailyPace.current[0]).toBe(0);
    expect(result.dailyPace.current[1]).toBe(10000);
    expect(result.dailyPace.current[11]).toBe(15000);
    expect(result.dailyPace.previous).toHaveLength(30);
    expect(result.dailyPace.previous[18]).toBe(0);
    expect(result.dailyPace.previous[19]).toBe(10000);
    expect(result.fixedVsVariable).toEqual([
      { month: '2026-05', fixedCents: 0, variableCents: 0 },
      { month: '2026-06', fixedCents: 0, variableCents: 0 },
      { month: '2026-07', fixedCents: 0, variableCents: 0 },
      { month: '2026-08', fixedCents: 0, variableCents: 0 },
      { month: '2026-09', fixedCents: 10000, variableCents: 0 },
      { month: '2026-10', fixedCents: 10000, variableCents: 5000 },
    ]);
  });

  it('adds September rent still to come when October has no matching merchant', () => {
    const result = summarize({
      month: '2026-10',
      today: TODAY,
      expenses: [expense('2026-10-10', 5000, false), ...septemberRent],
      incomeCents: INCOME,
      reserveCents: RESERVE,
      goalMonths: GOAL,
    });

    expect(result.monthTotalCents).toBe(5000);
    expect(result.projectedCents).toBe(10000 + Math.round((5000 / 12) * 31));
  });

  it('treats a lowercased merchant as already present this month', () => {
    const result = summarize({
      month: '2026-10',
      today: TODAY,
      expenses: [
        expense('2026-10-10', 5000, false, 'aluguel'),
        expense('2026-09-20', 10000, true, 'Aluguel'),
      ],
      incomeCents: INCOME,
      reserveCents: RESERVE,
      goalMonths: GOAL,
    });

    expect(result.projectedCents).toBe(Math.round((5000 / 12) * 31));
  });

  it('averages May through September and fills freedom', () => {
    const prior = ['2026-05-03', '2026-06-03', '2026-07-03', '2026-08-03'].map(
      (spentOn) => expense(spentOn, 10000, false),
    );
    const result = summarize({
      month: '2026-10',
      today: TODAY,
      expenses: [...prior, ...septemberRent, ...octoberWithRent],
      incomeCents: INCOME,
      reserveCents: RESERVE,
      goalMonths: GOAL,
    });

    expect(result.averageCents).toBe(10000);
    expect(result.freedom?.months).toBe(10);
    expect(result.freedom?.missingCents).toBe(12 * 10000 - 100000);
    expect(result.freedom?.deadlineMonths).toBe(0);
    expect(result.projectedCents).toBe(10000 + Math.round((5000 / 12) * 31));
  });

  it('uses full-month totals for a closed month', () => {
    const result = summarize({
      month: '2026-09',
      today: TODAY,
      expenses: [
        ...septemberRent,
        expense('2026-08-04', 4000, false),
        expense('2026-09-28', 2500, false),
      ],
      incomeCents: INCOME,
      reserveCents: RESERVE,
      goalMonths: GOAL,
    });

    expect(result.monthTotalCents).toBe(12500);
    expect(result.projectedCents).toBe(12500);
    expect(result.previousComparableCents).toBe(4000);
    expect(result.changePercent).toBe(212.5);
    expect(result.dailyPace.current).toHaveLength(30);
    expect(result.dailyPace.previous).toHaveLength(31);
  });

  it('rounds change to one decimal and leaves freedom null without a usable average', () => {
    const result = summarize({
      month: '2026-10',
      today: TODAY,
      expenses: [
        expense('2026-10-02', 10000, true, 'Aluguel'),
        expense('2026-09-04', 3000, false),
      ],
      incomeCents: null,
      reserveCents: null,
      goalMonths: null,
    });

    expect(result.changePercent).toBe(233.3);
    expect(result.leftoverCents).toBeNull();
    expect(result.freedom).toBeNull();
    expect(result.averageCents).toBe(3000);
  });

  it('returns null freedom when the five prior months are empty', () => {
    const result = summarize({
      month: '2026-10',
      today: TODAY,
      expenses: octoberWithRent,
      incomeCents: INCOME,
      reserveCents: RESERVE,
      goalMonths: GOAL,
    });

    expect(result.averageCents).toBe(0);
    expect(result.freedom).toBeNull();
    expect(result.monthTotalCents).toBe(15000);
    expect(result.projectedCents).toBe(10000 + Math.round((5000 / 12) * 31));
    expect(result.changePercent).toBeNull();
  });

  it('keeps days after today out of the partial total', () => {
    const result = summarize({
      month: '2026-10',
      today: TODAY,
      expenses: [
        ...octoberWithRent,
        expense('2026-10-20', 7000, false, 'Cinema', 'shopping'),
      ],
      incomeCents: INCOME,
      reserveCents: RESERVE,
      goalMonths: GOAL,
    });

    expect(result.monthTotalCents).toBe(15000);
    expect(result.byCategory.map((row) => row.category)).not.toContain(
      'shopping',
    );
    expect(result.lastSixMonths[5]).toEqual({
      month: '2026-10',
      amountCents: 15000,
    });
    expect(result.dailyPace.current).toHaveLength(12);
    expect(result.fixedVsVariable[5]).toEqual({
      month: '2026-10',
      fixedCents: 10000,
      variableCents: 5000,
    });
  });

  it('returns null freedom when income equals the five-month average', () => {
    const prior = [
      '2026-05-03',
      '2026-06-03',
      '2026-07-03',
      '2026-08-03',
      '2026-09-03',
    ].map((spentOn) => expense(spentOn, 10000, false));
    const result = summarize({
      month: '2026-10',
      today: TODAY,
      expenses: prior,
      incomeCents: 10000,
      reserveCents: RESERVE,
      goalMonths: GOAL,
    });

    expect(result.averageCents).toBe(10000);
    expect(result.freedom).toBeNull();
  });

  it('ignores months before the first expense and keeps freedom on today', () => {
    const expenses = [
      expense('2026-08-04', 10000, false),
      expense('2026-09-04', 187600, false),
      expense('2026-10-04', 5_000_000, false),
      expense('2026-10-28', 40000, false),
      expense('2026-11-02', 50000, false),
    ];
    const input = {
      today: '2026-10-21',
      expenses,
      incomeCents: 800000,
      reserveCents: 5_000_000,
      goalMonths: 12,
    };
    const october = summarize({ ...input, month: '2026-10' });
    const november = summarize({ ...input, month: '2026-11' });

    expect(october.averageCents).toBe(98800);
    expect(november.averageCents).toBe(october.averageCents);
    expect(october.freedom?.months).toBe(50.6);
    expect(november.freedom?.months).toBe(50.6);
    expect(november.lastSixMonths.map((row) => row.month)).toContain('2026-10');
    expect(november.lastSixMonths.find((row) => row.month === '2026-10')?.amountCents).toBe(
      5_000_000,
    );
  });
});

describe('saoPauloToday', () => {
  it('formats the America/Sao_Paulo calendar date', () => {
    expect(saoPauloToday(new Date('2026-10-12T02:30:00.000Z'))).toBe(
      '2026-10-11',
    );
    expect(saoPauloToday(new Date('2026-10-12T03:00:00.000Z'))).toBe(
      '2026-10-12',
    );
  });
});
