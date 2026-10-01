import { describe, expect, it } from 'vitest';
import { freedomSnapshot } from './freedom';

describe('freedomSnapshot', () => {
  it('cobre as contas de cima para baixo com o rendimento do principal', () => {
    // 12_000 USDC a 10% a.a. = 100 USDC/mês. Cobre 60 e 40, não cobre 100.
    const snapshot = freedomSnapshot({
      principalBaseUnits: '120000000000',
      apyPercent: '10',
      bills: [
        { id: '1', vendor: 'Netflix', monthlyCost: '600000000' },
        { id: '2', vendor: 'Spotify', monthlyCost: '400000000' },
        { id: '3', vendor: 'Academia', monthlyCost: '1000000000' },
      ],
    });
    expect(snapshot.freedom).toBe(50);
    expect(snapshot.rows.map((row) => row.covered)).toEqual([true, true, false]);
  });

  it('fica em zero sem contas', () => {
    const snapshot = freedomSnapshot({
      principalBaseUnits: '1000000000',
      apyPercent: '8',
      bills: [],
    });
    expect(snapshot.freedom).toBe(0);
  });
});
