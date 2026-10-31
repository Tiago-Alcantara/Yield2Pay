/**
 * Módulo: PainelGastos logout
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: Sair da conta no painel esquece o nome mostrado na doca.
 * Sequência: a conta carregada entra na memória; confirmar Sair zera essa vista e chama o logout do Privy.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saoPauloMonth } from './painel-format';

const logout = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock('@/providers/PrivyProviderWrapper', () => ({
  isPrivyConfigured: true,
}));
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    ready: true,
    authenticated: true,
    getAccessToken: async () => 'tok',
    logout,
  }),
}));

import { getAccountView, setAccountView } from '../_lib/accountStore';
import PainelGastos from './PainelGastos';

const PROFILE = {
  householdSize: 'two',
  monthlyIncomeCents: 1_200_000,
  reserveCents: 3_000_000,
  priorities: [],
  goalMonths: 12,
  cryptoExperience: null,
  onboardingCompleted: true,
  importMode: 'ofx',
  showFamily: true,
  showFreedom: true,
};

const ACCOUNT = {
  displayName: 'Marina',
  fullName: 'Marina Alves',
  email: 'marina@email.com',
  initials: 'MA',
  accountType: 'family',
  household: { id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true },
};

beforeEach(() => {
  logout.mockClear();
  localStorage.clear();
  setAccountView(null);
  window.history.pushState(null, '', '/dashboard');
  const month = saoPauloMonth();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const body = url.includes('/people')
        ? []
        : url.includes('/expenses/months')
          ? [month]
          : url.includes('/expenses')
            ? { items: [], total: 0 }
            : url.includes('/household/summary')
              ? {
                  monthTotalCents: 0,
                  previousComparableCents: 0,
                  changePercent: null,
                  projectedCents: 0,
                  leftoverCents: null,
                  byCategory: [],
                  lastSixMonths: [{ month, amountCents: 0 }],
                  averageCents: 0,
                  dailyPace: { current: [], previous: [] },
                  fixedVsVariable: [],
                  freedom: null,
                }
              : url.includes('/household/profile')
                ? PROFILE
                : url.includes('/households/current')
                  ? { id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true, pendingInvites: [] }
                  : url.includes('/account')
                    ? ACCOUNT
                    : url.includes('/lesson-progress')
                      ? []
                      : url.includes('/lessons')
                        ? []
                        : url.includes('/statements')
                          ? []
                          : [];
      const text = JSON.stringify(body);
      return { status: 200, ok: true, text: async () => text, json: async () => body };
    }),
  );
});

describe('logout no painel', () => {
  it('zera a conta vista pela doca ao confirmar Sair', async () => {
    render(<PainelGastos />);
    expect(await screen.findByText('Olá, Marina')).toBeInTheDocument();
    expect(getAccountView()?.displayName).toBe('Marina');

    fireEvent.click(screen.getAllByRole('button', { name: 'Configurações' })[0]);
    const settings = await screen.findByRole('dialog', { name: 'Configurações' });
    fireEvent.click(within(settings).getByRole('button', { name: 'Conta e dados' }));
    fireEvent.click(within(settings).getByRole('button', { name: 'Sair' }));
    const confirm = await screen.findByRole('dialog', { name: 'Confirmação' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Sair' }));

    expect(logout).toHaveBeenCalledOnce();
    expect(getAccountView()).toBeNull();
  });
});
