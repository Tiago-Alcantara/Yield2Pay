import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVenueTx } from './useVenueTx';

vi.mock('@privy-io/react-auth/extended-chains', () => ({
  useSignRawHash: vi.fn(),
}));

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'tok' }),
}));

vi.mock('./useWallet', () => ({
  useWallet: vi.fn(),
}));

vi.mock('./api', () => ({
  createApi: vi.fn(),
}));

import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { useWallet } from './useWallet';
import { createApi } from './api';

describe('useVenueTx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stellar:blend signs the hash then submits', async () => {
    (useWallet as any).mockReturnValue({
      address: 'GADDR',
      ensureWallet: vi.fn().mockResolvedValue('GADDR'),
    });
    (useSignRawHash as any).mockReturnValue({
      signRawHash: vi.fn().mockResolvedValue({ signature: '0xsig' }),
    });
    const buildVenueDeposit = vi.fn().mockResolvedValue({
      chain: 'stellar',
      xdr: 'X',
      hash: '0xh',
    });
    const submitVenueDeposit = vi.fn().mockResolvedValue({ txHash: 'TX' });
    (createApi as any).mockReturnValue({
      buildVenueDeposit,
      submitVenueDeposit,
      buildVenueWithdraw: vi.fn(),
      submitVenueWithdraw: vi.fn(),
    });

    const { result } = renderHook(() => useVenueTx());
    await expect(result.current.deposit('10750000')).resolves.toBe('TX');
    expect(buildVenueDeposit).toHaveBeenCalledWith(
      { chain: 'stellar', protocol: 'blend' },
      '10750000',
    );
    expect(submitVenueDeposit).toHaveBeenCalledWith(
      { chain: 'stellar', protocol: 'blend' },
      {
        amount: '10750000',
        xdr: 'X',
        signatureHex: '0xsig',
        stellarAddress: 'GADDR',
        address: 'GADDR',
      },
    );
  });

  it('solana:kamino submits the unsigned envelope (mock)', async () => {
    (useWallet as any).mockReturnValue({
      address: 'So1',
      ensureWallet: vi.fn().mockResolvedValue('So1'),
    });
    (useSignRawHash as any).mockReturnValue({ signRawHash: vi.fn() });
    const buildVenueDeposit = vi.fn().mockResolvedValue({
      chain: 'solana',
      transactionBase64: 'Ym9i',
    });
    const submitVenueDeposit = vi.fn().mockResolvedValue({ txHash: 'sol-tx' });
    (createApi as any).mockReturnValue({
      buildVenueDeposit,
      submitVenueDeposit,
      buildVenueWithdraw: vi.fn(),
      submitVenueWithdraw: vi.fn(),
    });

    const { result } = renderHook(() =>
      useVenueTx({ chain: 'solana', protocol: 'kamino' }),
    );
    await expect(result.current.deposit('1000000')).resolves.toBe('sol-tx');
    expect(submitVenueDeposit).toHaveBeenCalledWith(
      { chain: 'solana', protocol: 'kamino' },
      { amount: '1000000', signedTransactionBase64: 'Ym9i' },
    );
  });
});
