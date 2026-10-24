/**
 * Módulo: deposit
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: A tela de depósito PIX mostra o fluxo e não oferece outro meio.
 * Sequência: idle: mostra input R$ e botão Depositar; idle: projeção de rendimento mensal atualiza ao digitar; idle: Depositar chama start com o valor; awaiting_pix: mostra Pix e botão simular chama simulate; funded: Confirmar depósito chama confirm; applying: mostra progresso; done: mostra sucesso sem hash; error: mostra mensagem e botão tentar de novo.
 */
/**
 * deposit.test.tsx — fluxo de depósito Pix-only (web3 invisível).
 * Mocka useDepositFlow — sem rede/Privy.
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
  simulate: vi.fn(),
  confirm: vi.fn(),
  reset: vi.fn(),
};
vi.mock('@/lib/useDepositFlow', () => ({ useDepositFlow: () => flow }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/b2b/deposit',
}));

import DepositPage from './product-screen';

beforeEach(() => {
  flow.state = 'idle';
  flow.order = null;
  flow.error = null;
  flow.start.mockReset();
  flow.simulate.mockReset();
  flow.confirm.mockReset();
});

describe('Depósito Pix-only', () => {
  it('idle: mostra input R$ e botão Depositar', () => {
    render(<DepositPage />);
    expect(screen.getByRole('heading', { name: /quanto quer depositar/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/valor do depósito/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /depositar/i })).toBeInTheDocument();
  });

  it('idle: projeção de rendimento mensal atualiza ao digitar', async () => {
    render(<DepositPage />);
    const input = screen.getByLabelText(/valor do depósito/i);
    await userEvent.clear(input);
    await userEvent.type(input, '12000');
    // 12000 * 0.084 / 12 = 84
    expect(screen.getByText(/84,00/)).toBeInTheDocument();
  });

  it('idle: Depositar chama start com o valor', async () => {
    render(<DepositPage />);
    const input = screen.getByLabelText(/valor do depósito/i);
    await userEvent.clear(input);
    await userEvent.type(input, '250');
    fireEvent.click(screen.getByRole('button', { name: /depositar/i }));
    expect(flow.start).toHaveBeenCalledWith('250');
  });

  it('awaiting_pix: mostra Pix e botão simular chama simulate', () => {
    flow.state = 'awaiting_pix';
    flow.order = { orderId: 'o1', depositBankName: 'PIX', targetAmount: '18.71', fiatCurrency: 'BRL' };
    render(<DepositPage />);
    expect(screen.getByRole('heading', { name: /pague com pix/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /simular pix/i }));
    expect(flow.simulate).toHaveBeenCalled();
  });

  it('funded: Confirmar depósito chama confirm', () => {
    flow.state = 'funded';
    render(<DepositPage />);
    expect(screen.getByText(/pix recebido/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirmar depósito/i }));
    expect(flow.confirm).toHaveBeenCalled();
  });

  it('applying: mostra progresso', () => {
    flow.state = 'applying';
    render(<DepositPage />);
    expect(screen.getByText(/aplicando no seu cofre/i)).toBeInTheDocument();
  });

  it('done: mostra sucesso sem hash', () => {
    flow.state = 'done';
    render(<DepositPage />);
    expect(screen.getByText(/seu dinheiro está rendendo/i)).toBeInTheDocument();
  });

  it('error: mostra mensagem e botão tentar de novo', () => {
    flow.state = 'error';
    flow.error = 'Boom';
    render(<DepositPage />);
    expect(screen.getByText(/não deu pra concluir/i)).toBeInTheDocument();
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });
});
