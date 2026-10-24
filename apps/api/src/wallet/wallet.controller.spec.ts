/**
 * Módulo: wallet.controller
 * Criado em: 2026-06-30
 * Última atualização: 2026-10-22
 * Intuito: A rota de saldo delega para a carteira da company.
 * Sequência: GET /wallet/balance delega para walletService.getBalance(companyId).
 */
import { WalletController } from './wallet.controller';

describe('wallet.controller', () => {
  it('GET /wallet/balance delega para walletService.getBalance(companyId)', async () => {
    const walletService = {
      getBalance: vi
        .fn()
        .mockResolvedValue({ balance: '1200000000', spendable: '1185000000' }),
    };
    const ctrl = new WalletController(walletService as any);
    const r = await ctrl.balance({ companyId: 'co_1' } as any);
    expect(walletService.getBalance).toHaveBeenCalledWith('co_1');
    expect(r).toEqual({ balance: '1200000000', spendable: '1185000000' });
  });
});
