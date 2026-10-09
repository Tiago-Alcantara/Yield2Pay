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
const privyConfig = vi.hoisted(() => ({ configured: true }));

vi.mock('@/providers/PrivyProviderWrapper', () => ({
  get isPrivyConfigured() {
    return privyConfig.configured;
  },
}));

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
    privyConfig.configured = true;
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

  it('stays on the login screen when Privy is not configured', () => {
    privyConfig.configured = false;

    render(<LoginPage />);

    const googleButton = screen.getByRole('button', { name: /continuar com google/i });
    expect((googleButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toMatch(/não está disponível/i);
    expect(mockInitOAuth).not.toHaveBeenCalled();
  });

  it('links terms and privacy to real routes', () => {
    render(<LoginPage />);
    expect(screen.getByRole('link', { name: /termos/i }).getAttribute('href')).toBe(
      '/termos',
    );
    expect(
      screen.getByRole('link', { name: /privacidade/i }).getAttribute('href'),
    ).toBe('/privacidade');
  });
});

