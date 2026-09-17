/**
 * landing.test.tsx — Structure/smoke tests for the public landing page.
 *
 * Default language is PT. Asserts Portuguese copy + CTA routing to /login.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockLogin = vi.fn();

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: vi.fn(() => ({
    login: mockLogin,
    ready: true,
    authenticated: false,
    user: null,
  })),
}));

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

import LandingPage from './page';

describe('LandingPage', () => {
  it('renders the PT hero tagline', () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/o banco que paga seus softwares/i).length).toBeGreaterThan(0);
  });

  it('renders PT nav labels', () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/como funciona/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/serviços/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/por que yield2pay/i).length).toBeGreaterThan(0);
  });

  it('renders the hero CTA "Começar agora"', () => {
    render(<LandingPage />);
    const ctaBtns = screen.getAllByRole('button', { name: /começar agora/i });
    expect(ctaBtns.length).toBeGreaterThan(0);
  });

  it('clicking the hero CTA routes to /login', () => {
    render(<LandingPage />);
    const ctaBtns = screen.getAllByRole('button', { name: /começar agora/i });
    fireEvent.click(ctaBtns[0]);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
