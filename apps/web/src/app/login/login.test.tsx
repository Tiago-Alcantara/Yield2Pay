/**
 * Tests for the login/page.tsx component (Google-only flow).
 *
 * Default language is PT. Language toggle covers EN ↔ PT.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockInitOAuth = vi.fn().mockResolvedValue(undefined);
const mockReplace = vi.fn();

const privyState = { ready: true, authenticated: false };

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    ready: privyState.ready,
    authenticated: privyState.authenticated,
    user: null,
    getAccessToken: vi.fn().mockResolvedValue(null),
  })),
  useLoginWithOAuth: vi.fn(() => ({ initOAuth: mockInitOAuth, loading: false })),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace, push: vi.fn() })),
}));

import LoginPage from './page';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    privyState.ready = true;
    privyState.authenticated = false;
  });

  it('renders the Google sign-in button (PT default)', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /continuar com google/i })).toBeTruthy();
    expect(document.getElementById('fx-email')).toBeNull();
    expect(document.getElementById('fx-password')).toBeNull();
  });

  it('starts Google OAuth when the button is clicked', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /continuar com google/i }));
    expect(mockInitOAuth).toHaveBeenCalledWith({ provider: 'google' });
  });

  it('toggles language from PT to EN', async () => {
    render(<LoginPage />);
    expect(screen.getByText(/bem-vindo à yield2pay/i)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByText(/welcome to yield2pay/i)).toBeTruthy();
  });

  it('redirects to /dashboard when already authenticated', () => {
    privyState.authenticated = true;
    render(<LoginPage />);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });
});
