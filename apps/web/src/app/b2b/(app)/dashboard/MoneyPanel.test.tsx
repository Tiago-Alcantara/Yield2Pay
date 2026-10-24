/**
 * Módulo: MoneyPanel
 * Criado em: 2026-06-30
 * Última atualização: 2026-10-22
 * Intuito: O painel de dinheiro mostra carteira e vault e só habilita aportar quando há saldo.
 * Sequência: mostra saldo da carteira e posição do vault formatados; Aportar chama onDeposit; Sacar chama onWithdraw; saldo indisponível: mostra — e desabilita Aportar; desabilita Sacar quando não há posição no vault.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { MoneyPanel } from './MoneyPanel';

const base = {
  walletBalance: '1200000000', // 120.00
  spendable: '1185000000',
  vaultValue: '5000000000', // 500.00
  apyPercent: '15.00',
  onDeposit: vi.fn(),
  onWithdraw: vi.fn(),
};

describe('MoneyPanel', () => {
  it('mostra saldo da carteira e posição do vault formatados', () => {
    render(<MoneyPanel {...base} />);
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
  });

  it('Aportar chama onDeposit; Sacar chama onWithdraw', () => {
    const onDeposit = vi.fn();
    const onWithdraw = vi.fn();
    render(<MoneyPanel {...base} onDeposit={onDeposit} onWithdraw={onWithdraw} />);
    fireEvent.click(screen.getByRole('button', { name: /aportar/i }));
    fireEvent.click(screen.getByRole('button', { name: /sacar/i }));
    expect(onDeposit).toHaveBeenCalled();
    expect(onWithdraw).toHaveBeenCalled();
  });

  it('saldo indisponível: mostra — e desabilita Aportar', () => {
    render(<MoneyPanel {...base} walletBalance={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aportar/i })).toBeDisabled();
  });

  it('desabilita Sacar quando não há posição no vault', () => {
    render(<MoneyPanel {...base} vaultValue="0" />);
    expect(screen.getByRole('button', { name: /sacar/i })).toBeDisabled();
  });
});
