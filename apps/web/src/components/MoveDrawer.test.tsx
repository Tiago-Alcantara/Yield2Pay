/**
 * Módulo: MoveDrawer
 * Criado em: 2026-06-30
 * Última atualização: 2026-10-22
 * Intuito: A gaveta de aporte e saque valida o valor e confirma a transação.
 * Sequência: deposit: chama deposit com base units no confirmar; withdraw: chama withdraw com base units no confirmar; botão max preenche o valor com o máximo disponível; bloqueia confirmar quando o valor passa do máximo; mostra erro quando a transação falha; sucesso: mostra o hash e o botão fechar chama onSuccess.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockDeposit = vi.fn();
const mockWithdraw = vi.fn();
vi.mock('@/lib/useStellarTx', () => ({
  useStellarTx: () => ({ deposit: mockDeposit, withdraw: mockWithdraw }),
}));

import { MoveDrawer } from './MoveDrawer';

const baseProps = {
  maxBaseUnits: '1000000000', // 100.00
  apyPercent: '12.00',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

describe('MoveDrawer', () => {
  beforeEach(() => {
    mockDeposit.mockReset();
    mockWithdraw.mockReset();
  });

  it('deposit: chama deposit com base units no confirmar', async () => {
    mockDeposit.mockResolvedValue('txdep');
    render(<MoveDrawer mode="deposit" {...baseProps} />);
    const input = screen.getByLabelText(/valor/i);
    await userEvent.type(input, '10');
    fireEvent.click(screen.getByRole('button', { name: /confirmar aporte/i }));
    await waitFor(() => expect(mockDeposit).toHaveBeenCalledWith('100000000')); // 10 * 10^7
  });

  it('withdraw: chama withdraw com base units no confirmar', async () => {
    mockWithdraw.mockResolvedValue('txwit');
    render(<MoveDrawer mode="withdraw" {...baseProps} />);
    const input = screen.getByLabelText(/valor/i);
    await userEvent.type(input, '10');
    fireEvent.click(screen.getByRole('button', { name: /confirmar saque/i }));
    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledWith('100000000'));
  });

  it('botão max preenche o valor com o máximo disponível', async () => {
    render(<MoveDrawer mode="deposit" {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /max/i }));
    expect((screen.getByLabelText(/valor/i) as HTMLInputElement).value).toBe('100.00');
  });

  it('bloqueia confirmar quando o valor passa do máximo', async () => {
    render(<MoveDrawer mode="deposit" {...baseProps} />);
    await userEvent.type(screen.getByLabelText(/valor/i), '101');
    expect(screen.getByRole('button', { name: /confirmar aporte/i })).toBeDisabled();
  });

  it('mostra erro quando a transação falha', async () => {
    mockDeposit.mockRejectedValue(new Error('saldo insuficiente na carteira'));
    render(<MoveDrawer mode="deposit" {...baseProps} />);
    await userEvent.type(screen.getByLabelText(/valor/i), '10');
    fireEvent.click(screen.getByRole('button', { name: /confirmar aporte/i }));
    await waitFor(() => expect(screen.getByText(/saldo insuficiente/i)).toBeInTheDocument());
  });

  it('sucesso: mostra o hash e o botão fechar chama onSuccess', async () => {
    mockDeposit.mockResolvedValue('txdep123');
    const onSuccess = vi.fn();
    render(<MoveDrawer mode="deposit" {...baseProps} onSuccess={onSuccess} />);
    await userEvent.type(screen.getByLabelText(/valor/i), '10');
    fireEvent.click(screen.getByRole('button', { name: /confirmar aporte/i }));
    await waitFor(() => expect(screen.getByText(/txdep123/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));
    expect(onSuccess).toHaveBeenCalled();
  });
});
