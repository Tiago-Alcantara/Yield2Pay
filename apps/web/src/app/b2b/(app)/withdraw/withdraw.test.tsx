/**
 * Módulo: withdraw
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: A tela de saque PIX pede o valor e segue o fluxo até a confirmação.
 * Sequência: idle: mostra input e botão Sacar; Sacar chama start; processing: mostra progresso; done: mostra sucesso; error: mostra mensagem.
 */
/**
 * withdraw.test.tsx — saque via Pix (off-ramp), web3 invisível.
 * Mocka useWithdrawFlow.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const flow: any = {
  state: 'idle',
  order: null,
  error: null,
  start: vi.fn(),
  reset: vi.fn(),
};
vi.mock('@/lib/useWithdrawFlow', () => ({ useWithdrawFlow: () => flow }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/b2b/withdraw',
}));

import WithdrawPage from './product-screen';

beforeEach(() => {
  flow.state = 'idle';
  flow.order = null;
  flow.error = null;
  flow.start.mockReset();
});

describe('Saque via Pix', () => {
  it('idle: mostra input e botão Sacar; Sacar chama start', async () => {
    render(<WithdrawPage />);
    expect(screen.getByRole('heading', { name: /sacar via pix/i })).toBeInTheDocument();
    const input = screen.getByLabelText(/valor a sacar/i);
    await userEvent.clear(input);
    await userEvent.type(input, '50');
    fireEvent.click(screen.getByRole('button', { name: /^sacar$/i }));
    expect(flow.start).toHaveBeenCalledWith('50');
  });

  it('processing: mostra progresso', () => {
    flow.state = 'processing';
    render(<WithdrawPage />);
    expect(screen.getByText(/processando seu saque/i)).toBeInTheDocument();
  });

  it('done: mostra sucesso', () => {
    flow.state = 'done';
    flow.order = { targetAmount: '267.00', fiatCurrency: 'BRL' };
    render(<WithdrawPage />);
    expect(screen.getByText(/saque enviado/i)).toBeInTheDocument();
  });

  it('error: mostra mensagem', () => {
    flow.state = 'error';
    flow.error = 'Boom';
    render(<WithdrawPage />);
    expect(screen.getByText(/não deu pra concluir/i)).toBeInTheDocument();
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });
});
