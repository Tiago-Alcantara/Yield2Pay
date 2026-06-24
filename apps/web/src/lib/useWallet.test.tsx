/**
 * Tests for useWallet hook.
 *
 * Mocks:
 *   - @privy-io/react-auth        → usePrivy
 *   - @privy-io/react-auth/extended-chains → useCreateWallet
 *   - ../lib/api (via module-level mock of createApi factory)
 *
 * We do NOT import the real Privy SDK — tests must run without a Privy app id.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRegisterWallet = vi.fn().mockResolvedValue(undefined);
const mockCreateWallet = vi.fn();

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(),
}));

vi.mock('@privy-io/react-auth/extended-chains', () => ({
  useCreateWallet: vi.fn(() => ({ createWallet: mockCreateWallet })),
}));

// We mock createApi so useWallet gets a predictable api instance.
// useWallet calls createApi(getToken) internally; the mock returns a fixed api object.
vi.mock('./api', () => ({
  createApi: vi.fn(() => ({
    registerWallet: mockRegisterWallet,
  })),
}));

import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from './useWallet';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUserWithStellarWallet(address: string) {
  return {
    linkedAccounts: [
      {
        type: 'wallet' as const,
        chainType: 'stellar',
        walletClientType: 'privy',
        address,
        connectorType: 'embedded',
      },
    ],
  };
}

function makeUserWithoutStellarWallet() {
  return {
    linkedAccounts: [
      {
        type: 'wallet' as const,
        chainType: 'ethereum',
        walletClientType: 'privy',
        address: '0xdeadbeef',
        connectorType: 'embedded',
      },
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegisterWallet.mockResolvedValue(undefined);
  });

  it('returns address from existing stellar wallet and calls registerWallet once', async () => {
    const stellarAddress = 'GBEXISTING123';
    const mockUser = makeUserWithStellarWallet(stellarAddress);

    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
      getAccessToken: vi.fn().mockResolvedValue('tok-abc'),
    });

    const { result } = renderHook(() => useWallet());

    let address: string;
    await act(async () => {
      address = await result.current.ensureWallet();
    });

    expect(address!).toBe(stellarAddress);
    // createWallet should NOT have been called
    expect(mockCreateWallet).not.toHaveBeenCalled();
    // registerWallet should have been called exactly once with the stellar address
    expect(mockRegisterWallet).toHaveBeenCalledOnce();
    expect(mockRegisterWallet).toHaveBeenCalledWith({ stellarAddress });
  });

  it('creates a stellar wallet when none exists, then registers it', async () => {
    const newStellarAddress = 'GBNEWWALLET456';
    const mockUser = makeUserWithoutStellarWallet();

    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
      getAccessToken: vi.fn().mockResolvedValue('tok-def'),
    });

    mockCreateWallet.mockResolvedValue({
      wallet: { address: newStellarAddress, chainType: 'stellar' },
      user: { linkedAccounts: [] },
    });

    const { result } = renderHook(() => useWallet());

    let address: string;
    await act(async () => {
      address = await result.current.ensureWallet();
    });

    // createWallet must have been called with chainType:'stellar'
    expect(mockCreateWallet).toHaveBeenCalledOnce();
    expect(mockCreateWallet).toHaveBeenCalledWith({ chainType: 'stellar' });

    expect(address!).toBe(newStellarAddress);

    // registerWallet must be called with the new address
    expect(mockRegisterWallet).toHaveBeenCalledOnce();
    expect(mockRegisterWallet).toHaveBeenCalledWith({ stellarAddress: newStellarAddress });
  });

  it('exposes address as null when user has no stellar wallet yet', () => {
    const mockUser = makeUserWithoutStellarWallet();

    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
      getAccessToken: vi.fn().mockResolvedValue(null),
    });

    const { result } = renderHook(() => useWallet());
    expect(result.current.address).toBeNull();
  });

  it('exposes address when user already has a stellar wallet', () => {
    const stellarAddress = 'GBHASONE789';
    const mockUser = makeUserWithStellarWallet(stellarAddress);

    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
      getAccessToken: vi.fn().mockResolvedValue('tok-xyz'),
    });

    const { result } = renderHook(() => useWallet());
    expect(result.current.address).toBe(stellarAddress);
  });
});
