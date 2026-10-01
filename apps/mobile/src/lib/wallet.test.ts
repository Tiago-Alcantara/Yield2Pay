import { describe, expect, it, vi } from 'vitest';
import { ensureStellarWallet } from './wallet';

describe('ensureStellarWallet', () => {
  it('registra a carteira que já existe sem criar outra', async () => {
    const createWallet = vi.fn();
    const registerWallet = vi.fn().mockResolvedValue(undefined);
    await expect(
      ensureStellarWallet({ existingAddress: 'GABC', createWallet, registerWallet }),
    ).resolves.toBe('GABC');
    expect(createWallet).not.toHaveBeenCalled();
    expect(registerWallet).toHaveBeenCalledWith('GABC');
  });

  it('cria e registra quando ainda não há carteira Stellar', async () => {
    const createWallet = vi.fn().mockResolvedValue('GNEW');
    const registerWallet = vi.fn().mockResolvedValue(undefined);
    await expect(
      ensureStellarWallet({ existingAddress: null, createWallet, registerWallet }),
    ).resolves.toBe('GNEW');
    expect(registerWallet).toHaveBeenCalledWith('GNEW');
  });
});
