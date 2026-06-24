/**
 * Tests for AuthGate.
 *
 * Behaviour under test:
 *   1. When ready && !authenticated → redirects to /login AND does NOT render children
 *      (no flash of protected content).
 *   2. When !ready → renders nothing (no children, no redirect).
 *   3. When ready && authenticated → renders children and calls ensureWallet once.
 *
 * Privy and useWallet are fully mocked — no real Privy app id required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mockReplace = vi.fn();
const mockEnsureWallet = vi.fn().mockResolvedValue('GBADDR');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(),
}));

vi.mock('@/lib/useWallet', () => ({
  useWallet: vi.fn(() => ({ address: null, ensureWallet: mockEnsureWallet })),
}));

import { usePrivy } from '@privy-io/react-auth';
import { AuthGate } from './AuthGate';

describe('AuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureWallet.mockResolvedValue('GBADDR');
  });

  it('does NOT render children and redirects when ready && !authenticated', () => {
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({ ready: true, authenticated: false });

    render(
      <AuthGate>
        <div data-testid="protected">SECRET</div>
      </AuthGate>,
    );

    // Children must NOT be in the DOM (no flash of protected content)
    expect(screen.queryByTestId('protected')).toBeNull();
    // Redirect to /login
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('renders nothing while Privy is not ready', () => {
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({ ready: false, authenticated: false });

    render(
      <AuthGate>
        <div data-testid="protected">SECRET</div>
      </AuthGate>,
    );

    expect(screen.queryByTestId('protected')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renders children and provisions the wallet when authenticated', () => {
    (usePrivy as ReturnType<typeof vi.fn>).mockReturnValue({ ready: true, authenticated: true });

    render(
      <AuthGate>
        <div data-testid="protected">SECRET</div>
      </AuthGate>,
    );

    expect(screen.getByTestId('protected')).toBeTruthy();
    expect(mockEnsureWallet).toHaveBeenCalledOnce();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
