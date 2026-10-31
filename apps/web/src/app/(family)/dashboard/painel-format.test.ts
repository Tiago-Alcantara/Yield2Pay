import { MONTH_RANGE_CAP_NOTE, monthsCovering, visibleMonthSpan } from './painel-format';

describe('monthsCovering', () => {
  it('avisa quando o período passa de 36 meses', () => {
    const covered = monthsCovering('2023-01-01', '2026-10-30');
    expect(covered.months).toHaveLength(36);
    expect(covered.months[0]).toBe('2023-01');
    expect(covered.months[35]).toBe('2025-12');
    expect(covered.truncated).toBe(true);
    expect(MONTH_RANGE_CAP_NOTE).toMatch(/36 meses/);
  });

  it('não avisa quando o período cabe em 36 meses', () => {
    const covered = monthsCovering('2024-01-15', '2026-10-01');
    expect(covered.truncated).toBe(false);
    expect(covered.months).toHaveLength(34);
  });
});

describe('visibleMonthSpan', () => {
  it('D-06: inclui o mês vazio e o mês seguinte ao atual', () => {
    expect(visibleMonthSpan(['2026-10', '2026-08'], '2026-10')).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
  });

  it('D-06: sem gasto começa no mês atual e inclui o seguinte', () => {
    expect(visibleMonthSpan([], '2026-10')).toEqual(['2026-10', '2026-11']);
  });
});
