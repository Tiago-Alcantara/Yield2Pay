/**
 * Módulo: summary.golden
 * Criado em: 2026-11-03
 * Última atualização: 2026-11-03
 * Intuito: Congela, campo a campo, o resumo de quem só tem gastos. Os valores vieram do código anterior às entradas e este arquivo não muda com elas.
 * Sequência: o extrato e a nota de exemplo, sozinhos, no mês aberto; o exemplo repetido por seis meses, no mês aberto; o exemplo repetido por seis meses, num mês fechado; sem perfil, a sobra e a liberdade ficam nulas.
 */
import type { ExpenseCategory } from '@yield2pay/shared';
import { classifyMerchant, merchantKey } from '../expenses/classify';
import { clearLegacyKeyCache } from '../expenses/fixed-flags';
import { parseOfx } from '../statements/parse-ofx';
import { SummaryService } from './summary.service';

// Cópia do EXAMPLE_OFX e da EXAMPLE_NOTE de apps/web/.../dashboard/ImportModal.tsx.
const EXAMPLE_OFX = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><DTPOSTED>20261002</DTPOSTED><TRNAMT>-86.40</TRNAMT><NAME>Supermercado Extra</NAME></STMTTRN>
<STMTTRN><DTPOSTED>20261005</DTPOSTED><TRNAMT>-42.00</TRNAMT><NAME>Restaurante da Praça</NAME></STMTTRN>
<STMTTRN><DTPOSTED>20261008</DTPOSTED><TRNAMT>-28.90</TRNAMT><NAME>Uber</NAME></STMTTRN>
<STMTTRN><DTPOSTED>20261011</DTPOSTED><TRNAMT>-1200.00</TRNAMT><NAME>Aluguel</NAME></STMTTRN>
<STMTTRN><DTPOSTED>20261014</DTPOSTED><TRNAMT>-55.90</TRNAMT><NAME>Netflix</NAME></STMTTRN>
<STMTTRN><DTPOSTED>20261016</DTPOSTED><TRNAMT>-37.20</TRNAMT><NAME>Farmacia</NAME></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
const EXAMPLE_NOTE = {
  merchant: 'Supermercado Bom Preço',
  spentOn: '2026-10-12',
  amountCents: 18740,
};

const PROFILE = {
  monthlyIncomeCents: 500000,
  reserveCents: 100000,
  goalMonths: 12,
};
const FIXED_MERCHANTS = new Set(['Aluguel', 'Netflix']);

type Row = {
  id: string;
  spentOn: Date;
  merchant: string;
  category: ExpenseCategory;
  fixed: boolean;
  fixedManual: boolean;
  merchantKey: string;
  amountCents: number;
};

let nextId = 0;

function row(
  spentOn: string,
  merchant: string,
  amountCents: number,
  fixed: boolean,
  category: ExpenseCategory = classifyMerchant(merchant),
): Row {
  nextId += 1;
  return {
    id: `e${nextId}`,
    spentOn: new Date(`${spentOn}T00:00:00.000Z`),
    merchant,
    category,
    fixed,
    fixedManual: false,
    merchantKey: merchantKey(merchant),
    amountCents,
  };
}

/** As seis linhas do extrato de exemplo, com o mês trocado. */
function exampleMonth(month: string, withFixed: boolean): Row[] {
  return parseOfx(EXAMPLE_OFX).map((parsed) =>
    row(
      `${month}${parsed.spentOn.slice(7)}`,
      parsed.merchant,
      parsed.amountCents,
      withFixed && FIXED_MERCHANTS.has(parsed.merchant),
    ),
  );
}

function serviceWith(
  rows: Row[],
  profile: typeof PROFILE | Record<keyof typeof PROFILE, null> = PROFILE,
) {
  const prisma = {
    household: {
      findUnique: vi.fn().mockResolvedValue({ id: 'h1', ...profile }),
    },
    expense: {
      findMany: vi.fn().mockResolvedValue(rows),
      // O resumo pergunta o primeiro gasto; o cache de legado, a chave vazia.
      findFirst: vi.fn((args: { orderBy?: unknown }) =>
        Promise.resolve(
          args.orderBy
            ? ([...rows].sort(
                (left, right) =>
                  left.spentOn.getTime() - right.spentOn.getTime(),
              )[0] ?? null)
            : null,
        ),
      ),
    },
  };
  return new SummaryService(prisma as never);
}

const membership = {
  householdId: 'h1',
  companyId: 'co_1',
  role: 'owner',
  personal: true,
} as const;

const SIX_TO_OCTOBER = [
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
];

/** Acumulado do exemplo, sem a nota, do dia 1 ao dia 20. */
const EXAMPLE_PACE_TO_20 = [
  0, 8640, 8640, 8640, 12840, 12840, 12840, 15730, 15730, 15730, 135730, 135730,
  135730, 141320, 141320, 145040, 145040, 145040, 145040, 145040,
];

describe('golden do resumo de quem só tem gastos', () => {
  beforeEach(() => {
    clearLegacyKeyCache();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T15:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('o extrato e a nota de exemplo, sozinhos, no mês aberto', async () => {
    const rows = [
      ...exampleMonth('2026-10', false),
      row(
        EXAMPLE_NOTE.spentOn,
        EXAMPLE_NOTE.merchant,
        EXAMPLE_NOTE.amountCents,
        false,
      ),
    ];

    const result = await serviceWith(rows).summary(membership, '2026-10');

    expect(result.monthTotalCents).toBe(163780);
    expect(result.previousComparableCents).toBe(0);
    expect(result.changePercent).toBeNull();
    expect(result.projectedCents).toBe(253859);
    expect(result.leftoverCents).toBe(246141);
    expect(result.byCategory).toEqual([
      { category: 'housing', amountCents: 120000 },
      { category: 'groceries', amountCents: 27380 },
      { category: 'subscriptions', amountCents: 5590 },
      { category: 'restaurant', amountCents: 4200 },
      { category: 'health', amountCents: 3720 },
      { category: 'transport', amountCents: 2890 },
    ]);
    expect(result.lastSixMonths).toEqual(
      SIX_TO_OCTOBER.map((month) => ({
        month,
        amountCents: month === '2026-10' ? 163780 : 0,
      })),
    );
    expect(result.averageCents).toBe(0);
    expect(result.dailyPace.current).toEqual([
      0, 8640, 8640, 8640, 12840, 12840, 12840, 15730, 15730, 15730, 135730,
      154470, 154470, 160060, 160060, 163780, 163780, 163780, 163780, 163780,
    ]);
    expect(result.dailyPace.previous).toEqual(Array<number>(30).fill(0));
    expect(result.fixedVsVariable).toEqual(
      SIX_TO_OCTOBER.map((month) => ({
        month,
        fixedCents: 0,
        variableCents: month === '2026-10' ? 163780 : 0,
      })),
    );
    expect(result.freedom).toBeNull();
  });

  /** Seis meses de exemplo, uma escola fixa em setembro e um cinema futuro em outubro. */
  function sixMonths(): Row[] {
    return [
      ...SIX_TO_OCTOBER.flatMap((month) => exampleMonth(month, true)),
      row('2026-09-25', 'Escola Azul', 9900, true, 'education'),
      row('2026-10-25', 'Cinema', 7000, false, 'shopping'),
    ];
  }

  it('o exemplo repetido por seis meses, no mês aberto', async () => {
    const result = await serviceWith(sixMonths()).summary(
      membership,
      '2026-10',
    );

    expect(result.monthTotalCents).toBe(145040);
    expect(result.previousComparableCents).toBe(145040);
    expect(result.changePercent).toBe(0);
    expect(result.projectedCents).toBe(165638);
    expect(result.leftoverCents).toBe(334362);
    expect(result.byCategory).toEqual([
      { category: 'housing', amountCents: 120000 },
      { category: 'groceries', amountCents: 8640 },
      { category: 'subscriptions', amountCents: 5590 },
      { category: 'restaurant', amountCents: 4200 },
      { category: 'health', amountCents: 3720 },
      { category: 'transport', amountCents: 2890 },
    ]);
    expect(result.lastSixMonths).toEqual([
      { month: '2026-05', amountCents: 145040 },
      { month: '2026-06', amountCents: 145040 },
      { month: '2026-07', amountCents: 145040 },
      { month: '2026-08', amountCents: 145040 },
      { month: '2026-09', amountCents: 154940 },
      { month: '2026-10', amountCents: 145040 },
    ]);
    expect(result.averageCents).toBe(147020);
    expect(result.dailyPace.current).toEqual(EXAMPLE_PACE_TO_20);
    expect(result.dailyPace.previous).toEqual([
      ...EXAMPLE_PACE_TO_20,
      145040,
      145040,
      145040,
      145040,
      154940,
      154940,
      154940,
      154940,
      154940,
      154940,
    ]);
    expect(result.fixedVsVariable).toEqual([
      { month: '2026-05', fixedCents: 125590, variableCents: 19450 },
      { month: '2026-06', fixedCents: 125590, variableCents: 19450 },
      { month: '2026-07', fixedCents: 125590, variableCents: 19450 },
      { month: '2026-08', fixedCents: 125590, variableCents: 19450 },
      { month: '2026-09', fixedCents: 135490, variableCents: 19450 },
      { month: '2026-10', fixedCents: 125590, variableCents: 19450 },
    ]);
    expect(result.freedom).toEqual({
      months: 0.7,
      missingCents: 1664240,
      deadlineMonths: 4.7,
    });
  });

  it('o exemplo repetido por seis meses, num mês fechado', async () => {
    const result = await serviceWith(sixMonths()).summary(
      membership,
      '2026-09',
    );

    expect(result.monthTotalCents).toBe(154940);
    expect(result.previousComparableCents).toBe(145040);
    expect(result.changePercent).toBe(6.8);
    expect(result.projectedCents).toBe(154940);
    expect(result.leftoverCents).toBe(345060);
    expect(result.byCategory).toEqual([
      { category: 'housing', amountCents: 120000 },
      { category: 'education', amountCents: 9900 },
      { category: 'groceries', amountCents: 8640 },
      { category: 'subscriptions', amountCents: 5590 },
      { category: 'restaurant', amountCents: 4200 },
      { category: 'health', amountCents: 3720 },
      { category: 'transport', amountCents: 2890 },
    ]);
    expect(result.lastSixMonths).toEqual([
      { month: '2026-04', amountCents: 0 },
      { month: '2026-05', amountCents: 145040 },
      { month: '2026-06', amountCents: 145040 },
      { month: '2026-07', amountCents: 145040 },
      { month: '2026-08', amountCents: 145040 },
      { month: '2026-09', amountCents: 154940 },
    ]);
    expect(result.averageCents).toBe(147020);
    expect(result.dailyPace.current).toHaveLength(30);
    expect(result.dailyPace.current[29]).toBe(154940);
    expect(result.dailyPace.previous).toHaveLength(31);
    expect(result.dailyPace.previous[30]).toBe(145040);
    expect(result.fixedVsVariable).toEqual([
      { month: '2026-04', fixedCents: 0, variableCents: 0 },
      { month: '2026-05', fixedCents: 125590, variableCents: 19450 },
      { month: '2026-06', fixedCents: 125590, variableCents: 19450 },
      { month: '2026-07', fixedCents: 125590, variableCents: 19450 },
      { month: '2026-08', fixedCents: 125590, variableCents: 19450 },
      { month: '2026-09', fixedCents: 135490, variableCents: 19450 },
    ]);
    expect(result.freedom).toEqual({
      months: 0.7,
      missingCents: 1664240,
      deadlineMonths: 4.7,
    });
  });

  it('sem perfil, a sobra e a liberdade ficam nulas', async () => {
    const result = await serviceWith(sixMonths(), {
      monthlyIncomeCents: null,
      reserveCents: null,
      goalMonths: null,
    }).summary(membership, '2026-10');

    expect(result.monthTotalCents).toBe(145040);
    expect(result.projectedCents).toBe(165638);
    expect(result.leftoverCents).toBeNull();
    expect(result.averageCents).toBe(147020);
    expect(result.freedom).toBeNull();
  });
});
