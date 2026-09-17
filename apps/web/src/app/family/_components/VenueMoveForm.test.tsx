import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockDeposit = vi.fn();
const mockWithdraw = vi.fn();
const mockGetAccountChain = vi.fn();

const privyConfig = vi.hoisted(() => ({ configured: true }));

vi.mock('@/lib/useVenueTx', () => ({
  useVenueTx: () => ({ deposit: mockDeposit, withdraw: mockWithdraw }),
}));

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
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/components/ChainUnlockPanel', () => ({
  ChainUnlockPanel: () => <div data-testid="chain-unlock-panel" />,
}));

import { FamilyProvider } from '../_lib/FamilyProvider';
import { VenueMoveForm } from './VenueMoveForm';

function renderForm(mode: 'deposit' | 'withdraw') {
  return render(
    <FamilyProvider>
      <VenueMoveForm mode={mode} maxBaseUnits="1000000000" />
    </FamilyProvider>,
  );
}

describe('VenueMoveForm', () => {
  beforeEach(() => {
    privyConfig.configured = true;
    mockDeposit.mockReset();
    mockWithdraw.mockReset();
    mockGetAccountChain.mockReset();
    mockGetAccountChain.mockResolvedValue({
      selectedChain: 'stellar',
      unlockedChains: ['stellar'],
    });
  });

  it('shows configure message when Privy is not configured', () => {
    privyConfig.configured = false;

    renderForm('deposit');

    expect(screen.getByText(/configure o privy para investir ou sacar/i)).toBeInTheDocument();
    expect(mockGetAccountChain).not.toHaveBeenCalled();
  });

  it('deposit: chama deposit com base units no confirmar', async () => {
    mockDeposit.mockResolvedValue('txdep');
    renderForm('deposit');

    await waitFor(() => expect(mockGetAccountChain).toHaveBeenCalled());

    const input = screen.getByLabelText(/valor/i);
    await userEvent.type(input, '10');
    fireEvent.click(screen.getByRole('button', { name: /confirmar investimento/i }));

    await waitFor(() => expect(mockDeposit).toHaveBeenCalledWith('100000000'));
  });

  it('withdraw: chama withdraw com base units no confirmar', async () => {
    mockWithdraw.mockResolvedValue('txwit');
    renderForm('withdraw');

    await waitFor(() => expect(mockGetAccountChain).toHaveBeenCalled());

    const input = screen.getByLabelText(/valor/i);
    await userEvent.type(input, '10');
    fireEvent.click(screen.getByRole('button', { name: /confirmar saque do cofre/i }));

    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledWith('100000000'));
  });

  it('converte valores Solana com 6 casas decimais', async () => {
    mockGetAccountChain.mockResolvedValue({
      selectedChain: 'solana',
      unlockedChains: ['stellar', 'solana'],
    });
    mockDeposit.mockResolvedValue('txdep');
    renderForm('deposit');

    await waitFor(() => expect(mockGetAccountChain).toHaveBeenCalled());
    await userEvent.type(screen.getByLabelText(/valor/i), '10');
    fireEvent.click(screen.getByRole('button', { name: /confirmar investimento/i }));

    await waitFor(() => expect(mockDeposit).toHaveBeenCalledWith('10000000'));
  });

  it('bloqueia confirmar quando o valor passa do máximo', async () => {
    renderForm('deposit');

    await waitFor(() => expect(mockGetAccountChain).toHaveBeenCalled());

    await userEvent.type(screen.getByLabelText(/valor/i), '101');
    expect(screen.getByRole('button', { name: /confirmar investimento/i })).toBeDisabled();
  });
});
