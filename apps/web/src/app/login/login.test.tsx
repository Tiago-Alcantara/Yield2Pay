/**
 * Módulo: LoginPage
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: o login é só com Google, abre em português e manda quem já entrou para o painel.
 * Sequência: mostra o botão, inicia o OAuth ao clicar, troca para inglês, e redireciona se a sessão já existe.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Mocks ───────────────────────────────────────────────────────────────────────

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
  useSearchParams: () => new URLSearchParams(),
}));

// ── Component under test ───────────────────────────────────────────────────────

import LoginPage from './page';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    privyState.ready = true;
    privyState.authenticated = false;
  });

  it('mostra o botão do Google em português, sem formulário de senha', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /continuar com google/i })).toBeTruthy();
    expect(screen.getByText(/bem-vindo à yield2pay/i)).toBeTruthy();
    expect(document.getElementById('fx-email')).toBeNull();
    expect(document.getElementById('fx-password')).toBeNull();
  });

  it('inicia o OAuth do Google ao clicar', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /continuar com google/i }));
    expect(mockInitOAuth).toHaveBeenCalledWith({ provider: 'google' });
  });

  it('troca o texto de português para inglês', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByText(/welcome to yield2pay/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();
  });

  it('redirects to /dashboard when already authenticated', () => {
    privyState.authenticated = true;
    render(<LoginPage />);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });
});
