import { MONTH_RANGE_CAP, MONTH_RANGE_CAP_NOTE, isValidMonth, monthArrowSteps, monthsCovering, shiftMonth } from './painel-format';

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

describe('monthArrowSteps', () => {
  it('D-06: vai do primeiro gasto até o mês seguinte ao atual, sem pular o vazio', () => {
    expect(monthArrowSteps(['2026-10', '2026-08'], '2026-10')).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
  });

  it('D-06: sem gasto começa no mês atual e inclui o seguinte', () => {
    expect(monthArrowSteps([], '2026-10')).toEqual(['2026-10', '2026-11']);
  });

  it('D-06: gasto depois do mês seguinte estica a faixa até ele', () => {
    expect(monthArrowSteps(['2026-09', '2027-03'], '2026-10')).toEqual([
      '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03',
    ]);
  });

  it('D-06: a faixa contínua para em MONTH_RANGE_CAP meses do mês atual', () => {
    const steps = monthArrowSteps(['2020-01', '2026-10', '2032-01'], '2026-10');
    const oldest = shiftMonth('2026-10', -MONTH_RANGE_CAP);
    const newest = shiftMonth('2026-10', MONTH_RANGE_CAP);
    expect([oldest, newest]).toEqual(['2023-10', '2029-10']);
    expect(steps).not.toContain(shiftMonth(oldest, -1));
    expect(steps).not.toContain(shiftMonth(newest, 1));
    expect(steps.slice(1, -1)).toHaveLength(2 * MONTH_RANGE_CAP + 1);
    expect(steps[1]).toBe(oldest);
    expect(steps[steps.length - 2]).toBe(newest);
  });

  it('D-06: gasto a 37 meses para trás ou para frente entra como salto', () => {
    const before = shiftMonth('2026-10', -(MONTH_RANGE_CAP + 1));
    const after = shiftMonth('2026-10', MONTH_RANGE_CAP + 1);
    const steps = monthArrowSteps([before, '2026-10', after], '2026-10');
    expect([before, after]).toEqual(['2023-09', '2029-11']);
    expect(steps[0]).toBe(before);
    expect(steps[1]).toBe('2023-10');
    expect(steps[steps.length - 2]).toBe('2029-10');
    expect(steps[steps.length - 1]).toBe(after);
  });

  it('D-06: gasto em 1000-01 e 9999-12 não gera milhares de meses vazios', () => {
    const steps = monthArrowSteps(['1000-01', '2026-10', '9999-12'], '2026-10');
    expect(steps).toHaveLength(2 * MONTH_RANGE_CAP + 1 + 2);
    expect(steps[0]).toBe('1000-01');
    expect(steps[1]).toBe('2023-10');
    expect(steps[steps.length - 1]).toBe('9999-12');
  });

  it('D-06: a faixa começa em max(primeiro gasto, atual − 36)', () => {
    expect(monthArrowSteps(['2026-07', '1000-01'], '2026-10').slice(0, 2)).toEqual(['1000-01', '2023-10']);
    expect(monthArrowSteps(['2026-07'], '2026-10')[0]).toBe('2026-07');
  });

  it('D-06: ignora mês inválido como 2026-00 e 2026-13', () => {
    expect(monthArrowSteps(['2026-00', '2026-13', 'lixo', '2026-09'], '2026-10')).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(isValidMonth('2026-00')).toBe(false);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-12')).toBe(true);
  });

  it('D-06: rejeita o ano 0000', () => {
    expect(isValidMonth('0000-01')).toBe(false);
    expect(isValidMonth('0001-01')).toBe(true);
    expect(monthArrowSteps(['0000-05', '2026-09'], '2026-10')).toEqual(['2026-09', '2026-10', '2026-11']);
  });
});
