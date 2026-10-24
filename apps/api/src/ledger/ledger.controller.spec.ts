/**
 * Módulo: ledger.controller
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: A rota do razão delega o saldo gastável da company autenticada.
 * Sequência: returns spendable view with string-encoded bigints.
 */
import { LedgerController } from './ledger.controller';

describe('LedgerController', () => {
  it('returns spendable view with string-encoded bigints', async () => {
    const ledger = {
      computeSpendable: vi.fn().mockResolvedValue({
        vaultValue: 1075000n,
        principal: 1000000n,
        spendable: 75000n,
      }),
      getReturnsChangePercent: vi.fn().mockResolvedValue('+3.2'),
    };
    const vault = { getApyPercent: vi.fn().mockResolvedValue('7.50') };
    const ctrl = new LedgerController(ledger as any, vault as any);
    const r = await ctrl.dashboard({ companyId: 'co_1' } as any);
    expect(ledger.getReturnsChangePercent).toHaveBeenCalledWith('co_1', 75000n);
    expect(r).toEqual({
      vaultValue: '1075000',
      principal: '1000000',
      spendable: '75000',
      apyPercent: '7.50',
      returnsChangePercent: '+3.2',
    });
  });
});
