import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ErrorDetails } from '@/lib/errorDetails';
import { ErrorDialog } from './ErrorDialog';

const details: ErrorDetails = {
  statusCode: 408,
  errorId: 'ERR-8F3A-2C91',
  timestamp: '2026-08-17T13:58:41.207Z',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorDialog', () => {
  it('is a modal alert dialog described by its own title and message', () => {
    render(<ErrorDialog details={details} onClose={vi.fn()} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('O pedido demorou demais');
    expect(dialog).toHaveAccessibleDescription(/A conexão levou mais tempo/);
  });

  it('moves focus to the title when it opens', () => {
    render(<ErrorDialog details={details} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<ErrorDialog details={details} onClose={onClose} />);

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when the veil is clicked but not when the card is', async () => {
    const onClose = vi.fn();
    render(<ErrorDialog details={details} onClose={onClose} />);

    await userEvent.click(screen.getByRole('alertdialog'));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('error-dialog-veil'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes from the × and from the secondary button', async () => {
    const onClose = vi.fn();
    render(<ErrorDialog details={details} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fechar diálogo' }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('retries the action on a 408', async () => {
    const onRetry = vi.fn();
    render(<ErrorDialog details={details} onClose={vi.fn()} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('sends a 401 to login', async () => {
    const onLogin = vi.fn();
    render(
      <ErrorDialog details={{ ...details, statusCode: 401 }} onClose={vi.fn()} onLogin={onLogin} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Fazer login' }));

    expect(onLogin).toHaveBeenCalledOnce();
  });

  it('just closes on a 400 so the user can fix the data on the screen behind', async () => {
    const onClose = vi.fn();
    render(<ErrorDialog details={{ ...details, statusCode: 400 }} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Revisar dados' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('never offers to leave the screen the user was on', () => {
    render(<ErrorDialog details={details} onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Voltar ao início' })).not.toBeInTheDocument();
  });

  it('shows the error id with its copy button', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ErrorDialog details={details} onClose={vi.fn()} />);

    expect(screen.getByText('ERR-8F3A-2C91')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(writeText).toHaveBeenCalledWith('ERR-8F3A-2C91');
  });

  it('never shows technical details, not even when the payload carries them', () => {
    render(
      <ErrorDialog
        details={{
          ...details,
          technicalDetails: {
            method: 'POST',
            endpoint: '/deposit/build',
            requestId: 'req_404k4q7pz1m',
            message: 'TypeError: undefined balanceCents',
            stack: 'at computeYieldSplit',
          },
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText(/computeYieldSplit/)).not.toBeInTheDocument();
    expect(screen.queryByText(/balanceCents/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Detalhes técnicos/ })).not.toBeInTheDocument();
  });
});
