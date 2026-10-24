/**
 * Módulo: useDepositFlow
 * Criado em: 2026-06-30
 * Última atualização: 2026-10-22
 * Intuito: O fluxo de depósito passa por valor, construção, assinatura e envio.
 * Sequência: start: cria order e vai pra awaiting_pix; confirm: claim + depósito (trunca targetAmount a 7 casas) → done; confirm: pula o claim quando skip=true; confirm: retry após falha no depósito NÃO re-claima.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDepositFlow } from './useDepositFlow';

vi.mock('@privy-io/react-auth', () => ({ usePrivy: vi.fn() }));
vi.mock('@privy-io/react-auth/extended-chains', () => ({ useSignRawHash: vi.fn() }));
vi.mock('./useWallet', () => ({ useWallet: vi.fn() }));
vi.mock('./api', () => ({ createApi: vi.fn() }));

import { usePrivy } from '@privy-io/react-auth';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { useWallet } from './useWallet';
import { createApi } from './api';

const ADDR = 'GADDR123';
const ORDER = {
  orderId: 'o1',
  quoteId: 'q1',
  fiatCurrency: 'BRL',
  targetAmount: '18.715709759678541071014604750',
  feeAmount: '3.12',
  depositClabe: '',
  depositBankName: 'PIX',
  statusPage: '',
  expiresAt: '',
};

let api: any;

beforeEach(() => {
  vi.clearAllMocks();
  (usePrivy as any).mockReturnValue({
    getAccessToken: vi.fn().mockResolvedValue('tok'),
    user: { email: { address: 'a@b.com' } },
  });
  (useWallet as any).mockReturnValue({ address: ADDR, ensureWallet: vi.fn().mockResolvedValue(ADDR) });
  (useSignRawHash as any).mockReturnValue({
    signRawHash: vi.fn().mockResolvedValue({ signature: '0xsig' }),
  });
  api = {
    getRampStatus: vi.fn().mockResolvedValue({ ready: true }),
    rampSetup: vi.fn(),
    startOnramp: vi.fn().mockResolvedValue(ORDER),
    simulateFiatReceived: vi.fn().mockResolvedValue(undefined),
    getRampOrder: vi.fn().mockResolvedValue({ orderId: 'o1', status: 'completed' }),
    getOrderClaim: vi.fn().mockResolvedValue({ skip: false, xdr: 'CLAIMXDR', hash: '0xc' }),
    submitOrderClaim: vi.fn().mockResolvedValue({ txHash: 'CLAIMTX' }),
    buildDeposit: vi.fn().mockResolvedValue({ xdr: 'DEPXDR', hash: '0xd' }),
    submitDeposit: vi.fn().mockResolvedValue({ txHash: 'DEPTX' }),
  };
  (createApi as any).mockReturnValue(api);
});

describe('useDepositFlow', () => {
  it('start: cria order e vai pra awaiting_pix', async () => {
    const { result } = renderHook(() => useDepositFlow());
    await act(async () => { await result.current.start('100'); });
    expect(api.startOnramp).toHaveBeenCalledWith({ amountFiat: '100' });
    expect(result.current.state).toBe('awaiting_pix');
    expect(result.current.order?.orderId).toBe('o1');
  });

  it('confirm: claim + depósito (trunca targetAmount a 7 casas) → done', async () => {
    const { result } = renderHook(() => useDepositFlow());
    await act(async () => { await result.current.start('100'); });
    await act(async () => { await result.current.confirm(); });

    expect(api.getOrderClaim).toHaveBeenCalledWith('o1');
    expect(api.submitOrderClaim).toHaveBeenCalledWith('o1', {
      xdr: 'CLAIMXDR', signatureHex: '0xsig', stellarAddress: ADDR,
    });
    // 18.715709759678541... truncado a 7 casas = 18.7157097 → 187157097 base units
    expect(api.buildDeposit).toHaveBeenCalledWith('187157097');
    expect(api.submitDeposit).toHaveBeenCalledWith({
      xdr: 'DEPXDR', signatureHex: '0xsig', stellarAddress: ADDR,
      amount: '187157097', rampOrderId: 'o1',
    });
    expect(result.current.state).toBe('done');
  });

  it('confirm: pula o claim quando skip=true', async () => {
    api.getOrderClaim.mockResolvedValue({ skip: true });
    const { result } = renderHook(() => useDepositFlow());
    await act(async () => { await result.current.start('100'); });
    await act(async () => { await result.current.confirm(); });

    expect(api.submitOrderClaim).not.toHaveBeenCalled();
    expect(api.submitDeposit).toHaveBeenCalled();
    expect(result.current.state).toBe('done');
  });

  it('confirm: retry após falha no depósito NÃO re-claima', async () => {
    api.submitDeposit.mockRejectedValueOnce(new Error('deposit boom'));
    const { result } = renderHook(() => useDepositFlow());
    await act(async () => { await result.current.start('100'); });
    await act(async () => { await expect(result.current.confirm()).rejects.toThrow('deposit boom'); });
    expect(result.current.state).toBe('funded');

    await act(async () => { await result.current.confirm(); });
    // claim chamado só uma vez no total (não re-claimou no retry)
    expect(api.submitOrderClaim).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('done');
  });
});
