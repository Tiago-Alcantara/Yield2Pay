/**
 * Tests for the login/page.tsx component.
 *
 * Behaviour under test:
 *   1. Mode toggle: 'login' <-> 'signup' (segmented control)
 *   2. Password show/hide eye icon toggle
 *   3. Privy login() fires when the submit button is clicked in login mode
 *   4. Language toggle (EN / PT) changes visible text
 *
 * Privy is fully mocked — no real Privy app id required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Privy mock ─────────────────────────────────────────────────────────────────

const mockLogin = vi.fn();

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    login: mockLogin,
    ready: true,
    authenticated: false,
    user: null,
    getAccessToken: vi.fn().mockResolvedValue(null),
  })),
}));

// ── Component under test ───────────────────────────────────────────────────────

import LoginPage from './page';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in login mode by default', () => {
    render(<LoginPage />);
    // The mode toggle should show both Log in and Sign up
    // Use getAllBy since there may be multiple buttons with overlapping text
    const logInBtns = screen.getAllByRole('button', { name: /^log in$/i });
    expect(logInBtns.length).toBeGreaterThan(0);
    const signUpBtns = screen.getAllByRole('button', { name: /^sign up$/i });
    expect(signUpBtns.length).toBeGreaterThan(0);
    // email and password inputs visible (query by id attribute directly)
    expect(document.getElementById('fx-email')).toBeTruthy();
    expect(document.getElementById('fx-password')).toBeTruthy();
  });

  it('toggles from login to signup mode', async () => {
    render(<LoginPage />);
    // Click the first "Sign up" button (the segmented toggle one at top of form)
    const signupBtns = screen.getAllByRole('button', { name: /^sign up$/i });
    await userEvent.click(signupBtns[0]);
    // In signup mode, company name field should appear
    expect(document.getElementById('fx-company')).toBeTruthy();
  });

  it('toggles password visibility with eye button', async () => {
    render(<LoginPage />);
    const passwordInput = document.getElementById('fx-password') as HTMLInputElement;
    expect(passwordInput).not.toBeNull();
    expect(passwordInput.type).toBe('password');

    // Click the eye/show button — aria-label "Show password"
    const eyeBtn = screen.getByRole('button', { name: /show password/i });
    await userEvent.click(eyeBtn);
    expect(passwordInput.type).toBe('text');

    // Click again — should hide
    const hideBtn = screen.getByRole('button', { name: /hide password/i });
    await userEvent.click(hideBtn);
    expect(passwordInput.type).toBe('password');
  });

  it('calls Privy login() when form is submitted in login mode', async () => {
    render(<LoginPage />);

    // Fill in valid email and password using the input elements directly
    const emailInput = document.getElementById('fx-email') as HTMLInputElement;
    const passwordInput = document.getElementById('fx-password') as HTMLInputElement;

    await userEvent.type(emailInput, 'test@company.com');
    await userEvent.type(passwordInput, 'password123');

    // Click the main CTA submit button ("Log in") — the submit button inside the form
    const submitBtns = screen.getAllByRole('button', { name: /^log in$/i });
    // The submit button is of type="submit"; others are type="button"
    const submitBtn = submitBtns.find((b) => b.getAttribute('type') === 'submit');
    expect(submitBtn).toBeTruthy();
    await userEvent.click(submitBtn!);

    expect(mockLogin).toHaveBeenCalledOnce();
  });

  it('toggles language from EN to PT', async () => {
    render(<LoginPage />);

    // EN is default — verify an EN-only string
    expect(screen.getByText(/welcome back/i)).toBeTruthy();

    // Switch to PT
    const ptBtn = screen.getByRole('button', { name: 'PT' });
    await userEvent.click(ptBtn);

    // PT title
    expect(screen.getByText(/bem-vindo de volta/i)).toBeTruthy();
  });
});
