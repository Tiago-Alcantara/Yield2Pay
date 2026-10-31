import { MONTH_RANGE_CAP, MONTH_RANGE_CAP_NOTE, isValidMonth, monthArrowRange, monthsCovering, shiftMonth } from './painel-format';

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

describe('monthArrowRange', () => {
  it('D-06: vai do primeiro gasto até o mês seguinte ao atual', () => {
    expect(monthArrowRange(['2026-10', '2026-08'], '2026-10')).toEqual({ first: '2026-08', last: '2026-11' });
  });

  it('D-06: sem gasto começa no mês atual e inclui o seguinte', () => {
    expect(monthArrowRange([], '2026-10')).toEqual({ first: '2026-10', last: '2026-11' });
  });

  it('D-06: gasto depois do mês seguinte estica a faixa até ele', () => {
    expect(monthArrowRange(['2026-09', '2027-03'], '2026-10')).toEqual({ first: '2026-09', last: '2027-03' });
  });

  it('D-06: cada ponta para em MONTH_RANGE_CAP meses do mês atual', () => {
    const range = monthArrowRange(['1000-01', '2026-10', '9999-12'], '2026-10');
    expect(range).toEqual({ first: shiftMonth('2026-10', -MONTH_RANGE_CAP), last: shiftMonth('2026-10', MONTH_RANGE_CAP) });
    expect(range).toEqual({ first: '2023-10', last: '2029-10' });
  });

  it('D-06: ignora mês inválido como 2026-00 e 2026-13', () => {
    expect(monthArrowRange(['2026-00', '2026-13', 'lixo', '2026-09'], '2026-10')).toEqual({ first: '2026-09', last: '2026-11' });
    expect(isValidMonth('2026-00')).toBe(false);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-12')).toBe(true);
  });
});
