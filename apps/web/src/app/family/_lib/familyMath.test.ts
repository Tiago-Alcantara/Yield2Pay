import {
  coverageRows,
  coveredAmount,
  depositForMonthly,
  freedomPercent,
  monthlyTotalOf,
  monthlyYieldOf,
} from './familyMath';
import type { FamilySub } from './familyMath';

const SUBS: FamilySub[] = [
  { id: 'netflix', name: 'Netflix', price: 60, dia: 5 },
  { id: 'spotify', name: 'Spotify', price: 40, dia: 8 },
  { id: 'academia', name: 'Academia', price: 100, dia: 10 },
];

describe('monthlyYieldOf', () => {
  it('divide o rendimento anual em doze', () => {
    expect(monthlyYieldOf(12000, 10)).toBe(100); // 10% de 12.000 = 1.200/ano
  });
  it('é zero sem depósito ou sem cenário', () => {
    expect(monthlyYieldOf(0, 8)).toBe(0);
    expect(monthlyYieldOf(50000, 0)).toBe(0);
  });
});

describe('monthlyTotalOf', () => {
  it('soma as assinaturas e o valor avulso', () => {
    expect(monthlyTotalOf(SUBS)).toBe(200);
    expect(monthlyTotalOf(SUBS, 50)).toBe(250);
  });
});

describe('depositForMonthly', () => {
  it('devolve o depósito cujo rendimento cobre o valor mensal', () => {
    expect(depositForMonthly(100, 10)).toBe(12000);
  });
  it('é zero quando não há conta a cobrir', () => {
    expect(depositForMonthly(0, 8)).toBe(0);
  });
});

describe('freedomPercent', () => {
  it('é a fração do total mensal que o rendimento paga', () => {
    expect(freedomPercent(200, 50)).toBe(25);
  });
  it('trava em 100 quando o rendimento sobra', () => {
    expect(freedomPercent(200, 900)).toBe(100);
  });
  it('é zero quando não há assinatura na lista', () => {
    expect(freedomPercent(0, 900)).toBe(0);
  });
});

describe('coveredAmount', () => {
  it('nunca paga mais do que o total das assinaturas', () => {
    expect(coveredAmount(200, 900)).toBe(200);
    expect(coveredAmount(200, 80)).toBe(80);
  });
});

describe('coverageRows', () => {
  it('cobre de cima para baixo, na ordem de prioridade', () => {
    // 12.000 a 10% a.a. => R$ 100/mês de rendimento: cobre Netflix (60) e não
    // chega em Spotify (acumulado 100 cabe exatamente; Academia não).
    const rows = coverageRows(SUBS, 12000, 10);
    expect(rows.map((r) => r.covered)).toEqual([true, true, false]);
  });

  it('acumula o depósito necessário conta a conta', () => {
    const rows = coverageRows(SUBS, 0, 10);
    expect(rows[0].cumNeeded).toBe(7200); //  60/mês
    expect(rows[1].cumNeeded).toBe(12000); // 100/mês acumulado
    expect(rows[2].cumNeeded).toBe(24000); // 200/mês acumulado
  });

  it('mostra o que falta depositar para cada conta se pagar', () => {
    const rows = coverageRows(SUBS, 12000, 10);
    expect(rows[0].missing).toBe(0);
    expect(rows[1].missing).toBe(0);
    expect(rows[2].missing).toBe(12000); // 24.000 necessários − 12.000 depositados
  });

  it('não marca nada como coberto sem depósito', () => {
    const rows = coverageRows(SUBS, 0, 8);
    expect(rows.every((r) => !r.covered)).toBe(true);
  });
});
