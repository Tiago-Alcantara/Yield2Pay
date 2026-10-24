/**
 * Módulo: LandingPage
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: a página pública abre em português e o chamado principal leva ao login.
 * Sequência: confere o texto e a navegação em português, troca para inglês, e clica em Começar agora.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Next.js router mock ────────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// next/link renders as <a> in jsdom — no extra mock needed.

// ── Privy mock ─────────────────────────────────────────────────────────────────

const mockLogin = vi.fn();

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    login: mockLogin,
    ready: true,
    authenticated: false,
    user: null,
  })),
}));

// ── IntersectionObserver mock (jsdom doesn't have it) ─────────────────────────

const observeMock = vi.fn();
const unobserveMock = vi.fn();
const disconnectMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // @ts-expect-error — jsdom stub
  global.IntersectionObserver = class {
    observe = observeMock;
    unobserve = unobserveMock;
    disconnect = disconnectMock;
    constructor(_cb: unknown, _opts?: unknown) {}
  };
  // matchMedia stub for tilt effect guards
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// ── Component under test ───────────────────────────────────────────────────────

import LandingPage from './page';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LandingPage', () => {
  it('abre em português, com a navegação e o chamado principal', () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/o banco que paga seus softwares/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/como funciona/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/serviços/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/por que yield2pay/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /começar agora/i }).length).toBeGreaterThan(0);
  });

  it('troca o texto para inglês', () => {
    render(<LandingPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'EN' })[0]);
    expect(screen.getByText(/banking,\s+reinvented\s+for\s+software/i)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /get started/i }).length).toBeGreaterThan(0);
  });

  it('o chamado principal leva ao login', () => {
    render(<LandingPage />);
    fireEvent.click(screen.getAllByRole('button', { name: /começar agora/i })[0]);
    expect(mockPush).toHaveBeenCalledWith('/login?next=/b2b/dashboard');
  });
});
