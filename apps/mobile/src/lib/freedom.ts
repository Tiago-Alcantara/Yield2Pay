import {
  coverageRows,
  formatUsdc,
  freedomPercent,
  monthlyTotalOf,
  monthlyYieldOf,
  type CoverageRow,
  type FamilySub,
} from '@yield2pay/shared';

export interface FreedomSnapshot {
  deposit: number;
  ratePct: number;
  monthly: number;
  yieldPerMonth: number;
  freedom: number;
  rows: CoverageRow[];
}

export function freedomSnapshot(input: {
  principalBaseUnits: string;
  apyPercent: string;
  bills: Array<{ id: string; vendor: string; monthlyCost: string }>;
}): FreedomSnapshot {
  const deposit = humanAmount(input.principalBaseUnits);
  const ratePct = Number(input.apyPercent);
  const rate = Number.isFinite(ratePct) ? ratePct : 0;
  const subs: FamilySub[] = input.bills.map((bill) => ({
    id: bill.id,
    name: bill.vendor,
    price: humanAmount(bill.monthlyCost),
    dia: 1,
  }));
  const monthly = monthlyTotalOf(subs);
  const yieldPerMonth = monthlyYieldOf(deposit, rate);
  return {
    deposit,
    ratePct: rate,
    monthly,
    yieldPerMonth,
    freedom: freedomPercent(monthly, yieldPerMonth),
    rows: coverageRows(subs, deposit, rate),
  };
}

function humanAmount(baseUnits: string): number {
  const value = Number(formatUsdc(baseUnits || '0'));
  return Number.isFinite(value) ? value : 0;
}
