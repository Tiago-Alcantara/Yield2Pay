/**
 * Módulo: TxErrorBox
 * Criado em: 2026-06-25
 * Última atualização: 2026-10-22
 * Intuito: A caixa de erro da transação mostra a mensagem recebida.
 * Sequência: renders the given message.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TxErrorBox } from './TxErrorBox';

describe('TxErrorBox', () => {
  it('renders the given message', () => {
    render(<TxErrorBox message="Insufficient balance" />);
    expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
  });
});
