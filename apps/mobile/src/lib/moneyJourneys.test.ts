import { describe, expect, it, vi } from 'vitest';
import type { YieldApi } from '../api/client';
import { createDepositJourney, createWithdrawJourney, type TxSigner } from './moneyJourneys';

const sleep = async () => {};

function signer(): TxSigner {
  return {
    ensureWallet: vi.fn().mockResolvedValue('GABC'),
    sign: vi.fn().mockResolvedValue('0xsig'),
  };
}

describe('createDepositJourney', () => {
  it('prepara a rampa, espera o fiat e só então assina o claim e o depósito', async () => {
    const api = {
      getRampStatus: vi.fn().mockResolvedValue({ ready: false }),
      rampSetup: vi.fn().mockResolvedValue({ ready: true }),
      startOnramp: vi.fn().mockResolvedValue({
        orderId: 'ord-1',
        targetAmount: '10.5',
        depositClabe: '123',
        depositBankName: 'Banco',
      }),
      simulateFiatReceived: vi.fn().mockResolvedValue(undefined),
      getRampOrder: vi.fn().mockResolvedValue({ orderId: 'ord-1', status: 'completed' }),
      getOrderClaim: vi.fn().mockResolvedValue({ skip: false, xdr: 'CLAIM', hash: '0xclaim' }),
      submitOrderClaim: vi.fn().mockResolvedValue({ txHash: 'claim-tx' }),
      buildDeposit: vi.fn().mockResolvedValue({ xdr: 'DEP', hash: '0xdep' }),
      submitDeposit: vi.fn().mockResolvedValue({ txHash: 'dep-tx' }),
    } as unknown as YieldApi;
    const journey = createDepositJourney(sleep);
    const who = signer();

    await journey.start(api, { email: 'a@b.co', displayName: 'a' }, '50.00');
    await expect(journey.waitForFiat(api, true)).resolves.toBe('funded');
    await expect(
      journey.confirm(api, who, { confirm: vi.fn().mockResolvedValue(undefined) }),
    ).resolves.toBe('dep-tx');

    expect(api.rampSetup).toHaveBeenCalled();
    expect(who.sign).toHaveBeenCalledWith('GABC', '0xclaim');
    expect(who.sign).toHaveBeenCalledWith('GABC', '0xdep');
    expect(api.submitDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ rampOrderId: 'ord-1', amount: '105000000' }),
    );
  });

  it('não assina se a biometria falha e não repete o claim num retry', async () => {
    const api = {
      getOrderClaim: vi.fn().mockResolvedValue({ skip: false, xdr: 'CLAIM', hash: '0xclaim' }),
      submitOrderClaim: vi.fn().mockResolvedValue({ txHash: 'claim-tx' }),
      buildDeposit: vi.fn().mockRejectedValue(new Error('rpc')),
      submitDeposit: vi.fn(),
    } as unknown as YieldApi;
    const journey = createDepositJourney(sleep);
    const who = signer();
    await journey.start(
      {
        getRampStatus: vi.fn().mockResolvedValue({ ready: true }),
        startOnramp: vi.fn().mockResolvedValue({ orderId: 'ord-1', targetAmount: '1' }),
      } as unknown as YieldApi,
      { email: 'a@b.co', displayName: 'a' },
      '1',
    );

    const deny = { confirm: vi.fn().mockRejectedValue(new Error('Autenticação cancelada.')) };
    await expect(journey.confirm(api, who, deny)).rejects.toThrow(/cancelada/);
    expect(api.getOrderClaim).not.toHaveBeenCalled();

    await expect(
      journey.confirm(api, who, { confirm: vi.fn().mockResolvedValue(undefined) }),
    ).rejects.toThrow(/rpc/);
    await expect(
      journey.confirm(api, who, { confirm: vi.fn().mockResolvedValue(undefined) }),
    ).rejects.toThrow(/rpc/);
    expect(api.submitOrderClaim).toHaveBeenCalledTimes(1);
  });
});

describe('createWithdrawJourney', () => {
  it('saca do cofre, abre o off-ramp e assina a queima uma vez', async () => {
    const api = {
      getRampStatus: vi.fn().mockResolvedValue({ ready: true }),
      buildWithdraw: vi.fn().mockResolvedValue({ xdr: 'W', hash: '0xw' }),
      submitWithdraw: vi.fn().mockResolvedValue({ txHash: 'w-tx' }),
      startOfframp: vi.fn().mockResolvedValue({ orderId: 'off-1' }),
      getOrderBurn: vi
        .fn()
        .mockResolvedValueOnce({ ready: false })
        .mockResolvedValue({ ready: true, xdr: 'BURN', hash: '0xburn' }),
      submitOrderBurn: vi.fn().mockResolvedValue({ txHash: 'burn-tx' }),
    } as unknown as YieldApi;
    const who = signer();
    const journey = createWithdrawJourney(sleep);

    const result = await journey.start(
      api,
      who,
      { confirm: vi.fn().mockResolvedValue(undefined) },
      { email: 'a@b.co', displayName: 'a' },
      '2.5',
    );

    expect(result.burnSigned).toBe(true);
    expect(api.submitWithdraw).toHaveBeenCalledTimes(1);
    expect(who.sign).toHaveBeenCalledWith('GABC', '0xburn');
  });
});
