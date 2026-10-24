/**
 * Módulo: Toggle
 * Criado em: 2026-06-30
 * Última atualização: 2026-10-22
 * Intuito: O interruptor muda de estado e não muda quando está desabilitado.
 * Sequência: renders a switch reflecting the checked prop; calls onChange when clicked and enabled; does not call onChange when disabled.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('renders a switch reflecting the checked prop', () => {
    render(<Toggle checked aria-label="OpenAI" />);
    const sw = screen.getByRole('switch', { name: 'OpenAI' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange when clicked and enabled', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} aria-label="Slack" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Slack' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled aria-label="Linear" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Linear' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
