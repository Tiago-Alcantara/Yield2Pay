/**
 * Módulo: TxResultCard
 * Criado em: 2026-06-25
 * Última atualização: 2026-10-22
 * Intuito: O cartão de resultado mostra o hash e o estado da transação.
 * Sequência: renders the title, subtitle and transaction hash.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { TxResultCard } from './TxResultCard';

describe('TxResultCard', () => {
  it('renders the title, subtitle and transaction hash', () => {
    render(
      <TxResultCard
        title="Deposit confirmed!"
        subtitle="Your capital is now working for you."
        txHash="abc123"
      />,
    );
    expect(screen.getByText('Deposit confirmed!')).toBeInTheDocument();
    expect(
      screen.getByText('Your capital is now working for you.'),
    ).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });
});
