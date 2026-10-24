/**
 * Módulo: useStellarTx
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: O gancho de transação assina e envia o aporte ou o saque.
 * Sequência: should return txHash and call submitDeposit with correct parameters; should return txHash and call submitWithdraw with correct parameters; should propagate errors from ensureWallet; should propagate errors from buildDeposit; should propagate errors from signRawHash; should propagate errors from submitDeposit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStellarTx } from './useStellarTx';

// Mock dependencies
vi.mock('@privy-io/react-auth/extended-chains', () => ({
  useSignRawHash: vi.fn(),
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

describe('useStellarTx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deposit', () => {
    it('should return txHash and call submitDeposit with correct parameters', async () => {
      const mockAddress = 'GADDR123456789';
      const mockXdr = 'AAAAAX';
      const mockHash = '0xhash123';
      const mockSignature = '0xsig456';
      const mockTxHash = 'TX789';
      const amountBaseUnits = '10750000';

      // Mock useWallet
      const mockEnsureWallet = vi.fn().mockResolvedValue(mockAddress);
      (useWallet as any).mockReturnValue({
        address: mockAddress,
        ensureWallet: mockEnsureWallet,
      });

      // Mock useSignRawHash
      const mockSignRawHash = vi.fn().mockResolvedValue({
        signature: mockSignature,
      });
      (useSignRawHash as any).mockReturnValue({
        signRawHash: mockSignRawHash,
      });

      // Mock createApi
      const mockBuildDeposit = vi.fn().mockResolvedValue({
        xdr: mockXdr,
        hash: mockHash,
      });
      const mockSubmitDeposit = vi.fn().mockResolvedValue({
        txHash: mockTxHash,
      });
      (createApi as any).mockReturnValue({
        buildDeposit: mockBuildDeposit,
        submitDeposit: mockSubmitDeposit,
      });

      const { result } = renderHook(() => useStellarTx());

      const txHash = await result.current.deposit(amountBaseUnits);

      expect(txHash).toBe(mockTxHash);
      expect(mockEnsureWallet).toHaveBeenCalled();
      expect(mockBuildDeposit).toHaveBeenCalledWith(amountBaseUnits);
      expect(mockSignRawHash).toHaveBeenCalledWith({
        address: mockAddress,
        chainType: 'stellar',
        hash: mockHash,
      });
      expect(mockSubmitDeposit).toHaveBeenCalledWith({
        xdr: mockXdr,
        signatureHex: mockSignature,
        stellarAddress: mockAddress,
        amount: amountBaseUnits,
      });
    });
  });

  describe('withdraw', () => {
    it('should return txHash and call submitWithdraw with correct parameters', async () => {
      const mockAddress = 'GADDR123456789';
      const mockXdr = 'AAAAAX';
      const mockHash = '0xhash123';
      const mockSignature = '0xsig456';
      const mockTxHash = 'TX789';
      const amountBaseUnits = '5000000';

      // Mock useWallet
      const mockEnsureWallet = vi.fn().mockResolvedValue(mockAddress);
      (useWallet as any).mockReturnValue({
        address: mockAddress,
        ensureWallet: mockEnsureWallet,
      });

      // Mock useSignRawHash
      const mockSignRawHash = vi.fn().mockResolvedValue({
        signature: mockSignature,
      });
      (useSignRawHash as any).mockReturnValue({
        signRawHash: mockSignRawHash,
      });

      // Mock createApi
      const mockBuildWithdraw = vi.fn().mockResolvedValue({
        xdr: mockXdr,
        hash: mockHash,
      });
      const mockSubmitWithdraw = vi.fn().mockResolvedValue({
        txHash: mockTxHash,
      });
      (createApi as any).mockReturnValue({
        buildWithdraw: mockBuildWithdraw,
        submitWithdraw: mockSubmitWithdraw,
      });

      const { result } = renderHook(() => useStellarTx());

      const txHash = await result.current.withdraw(amountBaseUnits);

      expect(txHash).toBe(mockTxHash);
      expect(mockEnsureWallet).toHaveBeenCalled();
      expect(mockBuildWithdraw).toHaveBeenCalledWith(amountBaseUnits);
      expect(mockSignRawHash).toHaveBeenCalledWith({
        address: mockAddress,
        chainType: 'stellar',
        hash: mockHash,
      });
      expect(mockSubmitWithdraw).toHaveBeenCalledWith({
        xdr: mockXdr,
        signatureHex: mockSignature,
        stellarAddress: mockAddress,
        amount: amountBaseUnits,
      });
    });
  });

  describe('error propagation', () => {
    it('should propagate errors from ensureWallet', async () => {
      const testError = new Error('Wallet error');
      const mockEnsureWallet = vi.fn().mockRejectedValue(testError);
      (useWallet as any).mockReturnValue({
        address: null,
        ensureWallet: mockEnsureWallet,
      });

      (useSignRawHash as any).mockReturnValue({
        signRawHash: vi.fn(),
      });

      (createApi as any).mockReturnValue({
        buildDeposit: vi.fn(),
        submitDeposit: vi.fn(),
      });

      const { result } = renderHook(() => useStellarTx());

      await expect(result.current.deposit('10000')).rejects.toThrow('Wallet error');
    });

    it('should propagate errors from buildDeposit', async () => {
      const testError = new Error('Build error');
      const mockAddress = 'GADDR123';
      const mockEnsureWallet = vi.fn().mockResolvedValue(mockAddress);
      (useWallet as any).mockReturnValue({
        address: mockAddress,
        ensureWallet: mockEnsureWallet,
      });

      (useSignRawHash as any).mockReturnValue({
        signRawHash: vi.fn(),
      });

      const mockBuildDeposit = vi.fn().mockRejectedValue(testError);
      (createApi as any).mockReturnValue({
        buildDeposit: mockBuildDeposit,
        submitDeposit: vi.fn(),
      });

      const { result } = renderHook(() => useStellarTx());

      await expect(result.current.deposit('10000')).rejects.toThrow('Build error');
    });

    it('should propagate errors from signRawHash', async () => {
      const testError = new Error('Sign error');
      const mockAddress = 'GADDR123';
      const mockXdr = 'AAAAAX';
      const mockHash = '0xhash123';
      const mockEnsureWallet = vi.fn().mockResolvedValue(mockAddress);
      (useWallet as any).mockReturnValue({
        address: mockAddress,
        ensureWallet: mockEnsureWallet,
      });

      const mockSignRawHash = vi.fn().mockRejectedValue(testError);
      (useSignRawHash as any).mockReturnValue({
        signRawHash: mockSignRawHash,
      });

      const mockBuildDeposit = vi.fn().mockResolvedValue({
        xdr: mockXdr,
        hash: mockHash,
      });
      (createApi as any).mockReturnValue({
        buildDeposit: mockBuildDeposit,
        submitDeposit: vi.fn(),
      });

      const { result } = renderHook(() => useStellarTx());

      await expect(result.current.deposit('10000')).rejects.toThrow('Sign error');
    });

    it('should propagate errors from submitDeposit', async () => {
      const testError = new Error('Submit error');
      const mockAddress = 'GADDR123';
      const mockXdr = 'AAAAAX';
      const mockHash = '0xhash123';
      const mockSignature = '0xsig456';
      const mockEnsureWallet = vi.fn().mockResolvedValue(mockAddress);
      (useWallet as any).mockReturnValue({
        address: mockAddress,
        ensureWallet: mockEnsureWallet,
      });

      const mockSignRawHash = vi.fn().mockResolvedValue({
        signature: mockSignature,
      });
      (useSignRawHash as any).mockReturnValue({
        signRawHash: mockSignRawHash,
      });

      const mockBuildDeposit = vi.fn().mockResolvedValue({
        xdr: mockXdr,
        hash: mockHash,
      });
      const mockSubmitDeposit = vi.fn().mockRejectedValue(testError);
      (createApi as any).mockReturnValue({
        buildDeposit: mockBuildDeposit,
        submitDeposit: mockSubmitDeposit,
      });

      const { result } = renderHook(() => useStellarTx());

      await expect(result.current.deposit('10000')).rejects.toThrow('Submit error');
    });
  });
});
