import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ErrorRoute from './error';
import NotFoundRoute from './not-found';

describe('app/error.tsx', () => {
  it('shows the full-page error for a render crash', () => {
    render(<ErrorRoute error={new Error('boom')} unstable_retry={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: 'Algo saiu errado do nosso lado' }),
    ).toBeInTheDocument();
  });

  it('wires the retry button to the boundary retry', async () => {
    const unstable_retry = vi.fn();
    render(<ErrorRoute error={new Error('boom')} unstable_retry={unstable_retry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(unstable_retry).toHaveBeenCalledOnce();
  });

  it('keeps the same error id across re-renders so the user can report it', () => {
    const error = new Error('boom');
    const { rerender } = render(<ErrorRoute error={error} unstable_retry={vi.fn()} />);
    const firstId = screen.getByText(/^ERR-/).textContent;

    rerender(<ErrorRoute error={error} unstable_retry={vi.fn()} />);

    expect(screen.getByText(/^ERR-/).textContent).toBe(firstId);
  });
});

describe('app/not-found.tsx', () => {
  it('shows the 404 copy without a retry button', () => {
    render(<NotFoundRoute />);

    expect(screen.getByRole('heading', { name: 'Esta página não existe' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
  });
});
