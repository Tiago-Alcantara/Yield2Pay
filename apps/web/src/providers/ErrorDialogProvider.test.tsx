import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  publishErrorNotification,
  dismissErrorNotification,
} from '@/lib/errorNotifications';
import { ErrorDialogProvider } from './ErrorDialogProvider';

const details = {
  statusCode: 408 as const,
  errorId: 'ERR-8F3A-2C91',
  timestamp: '2026-08-17T13:58:41.207Z',
};

beforeEach(() => {
  dismissErrorNotification();
});

describe('ErrorDialogProvider', () => {
  it('renders the app and no dialog while nothing failed', () => {
    render(
      <ErrorDialogProvider>
        <button type="button">Depositar</button>
      </ErrorDialogProvider>,
    );

    expect(screen.getByRole('button', { name: 'Depositar' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('opens the dialog when a failure is published from outside React', () => {
    render(
      <ErrorDialogProvider>
        <button type="button">Depositar</button>
      </ErrorDialogProvider>,
    );

    act(() => publishErrorNotification(details));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'O pedido demorou demais' })).toBeInTheDocument();
  });

  it('closes the dialog and clears the store when the user dismisses it', async () => {
    render(
      <ErrorDialogProvider>
        <button type="button">Depositar</button>
      </ErrorDialogProvider>,
    );
    act(() => publishErrorNotification(details));

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('makes the screen behind inert while the modal is open', () => {
    render(
      <ErrorDialogProvider>
        <button type="button">Depositar</button>
      </ErrorDialogProvider>,
    );
    const appContent = screen.getByTestId('app-content');
    expect(appContent).not.toHaveAttribute('inert');

    act(() => publishErrorNotification(details));

    expect(appContent).toHaveAttribute('inert');
  });
});
