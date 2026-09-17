import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetAccountChain = vi.fn();
const mockSetAccountChain = vi.fn();

const privyConfig = vi.hoisted(() => ({ configured: true }));

vi.mock('@/providers/PrivyProviderWrapper', () => ({
  get isPrivyConfigured() {
    return privyConfig.configured;
  },
}));

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'tok' }),
}));

vi.mock('@/lib/api', () => ({
  createApi: () => ({
    getAccountChain: mockGetAccountChain,
    setAccountChain: mockSetAccountChain,
  }),
}));

import { ChainUnlockPanel } from './ChainUnlockPanel';

describe('ChainUnlockPanel', () => {
  beforeEach(() => {
    privyConfig.configured = true;
    mockGetAccountChain.mockReset();
    mockSetAccountChain.mockReset();
  });

  it('shows configure message when Privy is not configured', () => {
    privyConfig.configured = false;

    render(<ChainUnlockPanel />);

    expect(screen.getByText(/configure o privy para gerir redes/i)).toBeInTheDocument();
    expect(mockGetAccountChain).not.toHaveBeenCalled();
  });

  it('shows selected chain and unlocks solana', async () => {
    mockGetAccountChain.mockResolvedValue({
      selectedChain: 'stellar',
      unlockedChains: ['stellar'],
    });
    mockSetAccountChain.mockResolvedValue({
      selectedChain: 'stellar',
      unlockedChains: ['stellar', 'solana'],
    });

    render(<ChainUnlockPanel />);

    await waitFor(() => {
      expect(screen.getByText(/selecionada:/i)).toHaveTextContent(/stellar/i);
      expect(screen.getByText(/desbloqueadas:/i)).toHaveTextContent(/stellar/i);
    });

    fireEvent.click(screen.getByRole('button', { name: /desbloquear solana/i }));

    await waitFor(() => {
      expect(mockSetAccountChain).toHaveBeenCalledWith({
        action: 'unlock',
        chainId: 'solana',
      });
    });
  });

  it('selects solana when unlocked', async () => {
    mockGetAccountChain.mockResolvedValue({
      selectedChain: 'stellar',
      unlockedChains: ['stellar', 'solana'],
    });
    mockSetAccountChain.mockResolvedValue({
      selectedChain: 'solana',
      unlockedChains: ['stellar', 'solana'],
    });

    render(<ChainUnlockPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /selecionar solana/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /selecionar solana/i }));

    await waitFor(() => {
      expect(mockSetAccountChain).toHaveBeenCalledWith({
        action: 'select',
        chainId: 'solana',
      });
    });
  });
});
