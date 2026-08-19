import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ErrorDetails } from '@/lib/errorDetails';
import { TechnicalPanel } from './TechnicalPanel';

const details: ErrorDetails = {
  statusCode: 500,
  errorId: 'ERR-8F3A-2C91',
  timestamp: '2026-08-17T13:58:41.207Z',
  technicalDetails: {
    method: 'POST',
    endpoint: '/deposit/build',
    requestId: 'req_404k4q7pz1m',
    message: 'TypeError: Cannot read properties of undefined (reading "balanceCents")',
    stack: 'TypeError: undefined\n    at computeYieldSplit (allocate.service.ts:128:34)',
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('TechnicalPanel', () => {
  it('lists the fields a developer needs to locate the failure', () => {
    render(<TechnicalPanel details={details} />);

    expect(screen.getByText('/deposit/build')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('req_404k4q7pz1m')).toBeInTheDocument();
    expect(screen.getByText(/balanceCents/)).toBeInTheDocument();
    expect(screen.getByText(/computeYieldSplit/)).toBeInTheDocument();
  });

  it('collapses and expands the details', async () => {
    render(<TechnicalPanel details={details} />);
    const toggle = screen.getByRole('button', { name: /Detalhes técnicos/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/computeYieldSplit/)).not.toBeInTheDocument();
  });

  it('points the toggle at the panel it controls', () => {
    render(<TechnicalPanel details={details} />);
    const toggle = screen.getByRole('button', { name: /Detalhes técnicos/ });

    const panelId = toggle.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId as string)).toBeInTheDocument();
  });

  it('copies the whole payload as JSON so it can be pasted into a ticket', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<TechnicalPanel details={details} />);

    await userEvent.click(screen.getByRole('button', { name: 'Copiar tudo' }));

    const copied = JSON.parse(writeText.mock.calls[0][0] as string);
    expect(copied).toMatchObject({
      errorId: 'ERR-8F3A-2C91',
      statusCode: 500,
      timestamp: '2026-08-17T13:58:41.207Z',
      endpoint: '/deposit/build',
      method: 'POST',
      requestId: 'req_404k4q7pz1m',
    });
    expect(copied.stack).toContain('computeYieldSplit');
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('marks the payload with the environment it came from', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<TechnicalPanel details={details} />);

    await userEvent.click(screen.getByRole('button', { name: 'Copiar tudo' }));

    expect(JSON.parse(writeText.mock.calls[0][0] as string)).toHaveProperty('environment');
  });
});
