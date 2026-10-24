/**
 * Módulo: withdraw.service
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: O saque monta a transação e só envia se o endereço é o da carteira registrada.
 * Sequência: build: builds withdraw xdr for the company wallet; submit: attaches sig, submits and records the withdraw; submit: rejects with ForbiddenException when stellarAddress does not match registered wallet.
 */
import { ForbiddenException } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';

describe('withdraw.service', () => {
  it('build: builds withdraw xdr for the company wallet', async () => {
    const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
    const vault = { buildWithdraw: vi.fn().mockResolvedValue({ xdr: 'WXDR' }) };
    const stellar = {
      hashForSigning: vi.fn().mockReturnValue({ hash: '0xdef' }),
    };
    const ledger = { recordWithdraw: vi.fn() };
    const svc = new WithdrawService(
      vault as any,
      stellar as any,
      wallet as any,
      ledger as any,
    );
    const r = await svc.build('co_1', 250000n);
    expect(vault.buildWithdraw).toHaveBeenCalledWith('GADDR', 250000n);
    expect(r).toEqual({ xdr: 'WXDR', hash: '0xdef' });
  });

  it('submit: attaches sig, submits and records the withdraw', async () => {
    const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
    const stellar = {
      attachAndSubmit: vi.fn().mockResolvedValue({ txHash: 'TXW' }),
    };
    const ledger = { recordWithdraw: vi.fn().mockResolvedValue(undefined) };
    const svc = new WithdrawService(
      {} as any,
      stellar as any,
      wallet as any,
      ledger as any,
    );
    const r = await svc.submit('co_1', {
      xdr: 'X',
      signatureHex: '0xs',
      stellarAddress: 'GADDR',
      amount: '250000',
    });
    expect(stellar.attachAndSubmit).toHaveBeenCalledWith('X', 'GADDR', '0xs');
    expect(ledger.recordWithdraw).toHaveBeenCalledWith('co_1', 250000n, 'TXW');
    expect(r).toEqual({ txHash: 'TXW' });
  });

  it('submit: rejects with ForbiddenException when stellarAddress does not match registered wallet', async () => {
    const wallet = { getAddress: vi.fn().mockResolvedValue('GADDR') };
    const stellar = { attachAndSubmit: vi.fn() };
    const ledger = { recordWithdraw: vi.fn() };
    const svc = new WithdrawService(
      {} as any,
      stellar as any,
      wallet as any,
      ledger as any,
    );
    await expect(
      svc.submit('co_1', {
        xdr: 'X',
        signatureHex: '0xs',
        stellarAddress: 'GEVIL',
        amount: '250000',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(stellar.attachAndSubmit).not.toHaveBeenCalled();
    expect(ledger.recordWithdraw).not.toHaveBeenCalled();
  });
});
