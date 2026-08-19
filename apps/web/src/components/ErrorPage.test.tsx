import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ErrorDetails } from '@/lib/errorDetails';
import { ErrorPage } from './ErrorPage';

const details: ErrorDetails = {
  statusCode: 500,
  errorId: 'ERR-8F3A-2C91',
  timestamp: '2026-08-17T13:58:41.207Z',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorPage', () => {
  it('shows the copy of the received status', () => {
    render(<ErrorPage details={details} />);

    expect(screen.getByRole('heading', { name: 'Algo saiu errado do nosso lado' })).toBeInTheDocument();
    expect(screen.getByText('Erro 500 · falha interna')).toBeInTheDocument();
  });

  it('announces itself to screen readers as soon as it renders', () => {
    render(<ErrorPage details={details} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('moves focus to the title so the user is not left on the previous page', () => {
    render(<ErrorPage details={details} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('offers retry and home on a 500', async () => {
    const onRetry = vi.fn();
    render(<ErrorPage details={details} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Voltar ao início' })).toBeInTheDocument();
  });

  it('offers no retry on a 404 because retrying cannot fix it', () => {
    render(<ErrorPage details={{ ...details, statusCode: 404 }} />);

    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar ao início' })).toBeInTheDocument();
  });

  it('sends a 401 to the login screen', async () => {
    const onLogin = vi.fn();
    render(<ErrorPage details={{ ...details, statusCode: 401 }} onLogin={onLogin} />);

    await userEvent.click(screen.getByRole('button', { name: 'Fazer login' }));

    expect(onLogin).toHaveBeenCalledOnce();
  });

  it('shows the error id and its timestamp in pt-BR', () => {
    // Calculado, e não fixo, porque o horário exibido depende do fuso da máquina.
    const expectedTimestamp = new Date(details.timestamp).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
    render(<ErrorPage details={details} />);

    expect(screen.getByText('ERR-8F3A-2C91')).toBeInTheDocument();
    expect(screen.getByText(expectedTimestamp)).toBeInTheDocument();
  });

  it('copies the error id and confirms it to the user', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ErrorPage details={details} />);

    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(writeText).toHaveBeenCalledWith('ERR-8F3A-2C91');
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('never renders the technical panel in a production bundle, even with data for it', () => {
    render(
      <ErrorPage
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
      />,
    );

    expect(screen.queryByRole('button', { name: /Detalhes técnicos/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/balanceCents/)).not.toBeInTheDocument();
    expect(screen.queryByText('staging')).not.toBeInTheDocument();
  });
});

describe('ErrorPage in a staging bundle', () => {
  /**
   * SHOW_TECHNICAL_DETAILS é constante de módulo, avaliada no import — por isso
   * o env é trocado antes de um import dinâmico com os módulos resetados.
   */
  async function renderInStaging(errorDetails: ErrorDetails) {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
    const { ErrorPage: StagingErrorPage } = await import('./ErrorPage');
    render(<StagingErrorPage details={errorDetails} />);
  }

  const stagingDetails: ErrorDetails = {
    ...details,
    technicalDetails: {
      method: 'POST',
      endpoint: '/deposit/build',
      requestId: 'req_404k4q7pz1m',
      message: 'TypeError: undefined balanceCents',
      stack: 'at computeYieldSplit',
    },
  };

  it('shows the technical panel and flags the environment', async () => {
    await renderInStaging(stagingDetails);

    expect(screen.getByRole('button', { name: /Detalhes técnicos/ })).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText(/balanceCents/)).toBeInTheDocument();
  });

  it('shows no panel when the payload carries no technical details', async () => {
    await renderInStaging(details);

    expect(screen.queryByRole('button', { name: /Detalhes técnicos/ })).not.toBeInTheDocument();
  });
});
