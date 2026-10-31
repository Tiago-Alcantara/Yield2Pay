/**
 * Módulo: family
 * Criado em: 2026-08-16
 * Última atualização: 2026-10-22
 * Intuito: A entrada da família e o painel de gastos abrem com a casa e os gastos do mês.
 * Sequência: mostra a proposta em português por padrão; troca a página inteira para inglês pelo seletor de idioma; recalcula o percentual de liberdade ao marcar mais uma assinatura; reage ao cenário de rendimento escolhido; exige e-mail válido na lista de espera; apaga um gasto da lista; abre a trilha ao começar a primeira aula; mostra o painel de gastos e não chama a carteira; abre o modal de filtros; não mostra gasto zerado quando a API falha; abre o modal de extrato com as três formas de trazer gastos.
 */
/**
 * family.test.tsx
 * Testes de comportamento das telas de família: a calculadora da landing
 * (store local) e o painel de gastos (API da casa, sem carteira).
 */
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const push = vi.fn();
const ensureWallet = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock('@/lib/useWallet', () => ({
  useWallet: () => {
    ensureWallet();
    return { ensureWallet };
  },
}));

import { FamilyProvider } from './_lib/FamilyProvider';
import { resetFamilyStore } from './_lib/familyStore';
import { saoPauloMonth } from './dashboard/painel-format';
import FamilyLandingPage from './page';
import FamilyDashboardPage from './dashboard/page';

function renderInFamily(ui: React.ReactElement) {
  return render(<FamilyProvider>{ui}</FamilyProvider>);
}

beforeEach(() => {
  push.mockClear();
  resetFamilyStore();
});

describe('landing /family', () => {
  it('mostra a proposta em português por padrão', () => {
    renderInFamily(<FamilyLandingPage />);
    expect(
      screen.getByText('O rendimento do seu próprio dinheiro paga suas assinaturas.'),
    ).toBeInTheDocument();
  });

  it('troca a página inteira para inglês pelo seletor de idioma', () => {
    renderInFamily(<FamilyLandingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(
      screen.getByText('The yield on your own money pays your subscriptions.'),
    ).toBeInTheDocument();
  });

  it('recalcula o percentual de liberdade ao marcar mais uma assinatura', () => {
    renderInFamily(<FamilyLandingPage />);
    // Padrão: R$ 60.000 a 8% a.a. = R$ 400/mês contra R$ 283,80 de assinaturas.
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Academia (R$ 129,90) leva o total a R$ 413,70 — o rendimento não cobre mais tudo.
    fireEvent.click(screen.getByRole('button', { name: /Academia/ }));
    expect(screen.getByText('97%')).toBeInTheDocument();
  });

  it('reage ao cenário de rendimento escolhido', () => {
    renderInFamily(<FamilyLandingPage />);
    fireEvent.click(screen.getByRole('button', { name: '6% a.a.' }));
    // 60.000 a 6% = R$ 300/mês contra R$ 283,80 — ainda cobre tudo.
    expect(screen.getByText('100%')).toBeInTheDocument();
    // "Suas assinaturas" e "Coberto no cenário" mostram o mesmo valor aqui.
    expect(screen.getAllByText('R$ 283,80')).toHaveLength(2);
  });

  it('exige e-mail válido na lista de espera', () => {
    renderInFamily(<FamilyLandingPage />);
    const submit = screen.getByRole('button', { name: 'Entrar na lista' });

    fireEvent.change(screen.getByLabelText('Seu e-mail'), { target: { value: 'ana' } });
    fireEvent.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Digite um e-mail válido');

    fireEvent.change(screen.getByLabelText('Seu e-mail'), { target: { value: 'ana@email.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na lista' }));
    expect(screen.getByRole('button', { name: 'Pronto — a gente avisa você' })).toBeInTheDocument();
  });
});

describe('painel /dashboard', () => {
  const month = saoPauloMonth();

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const body = url.includes('/expenses/months')
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
                ? {
                    householdSize: 'two',
                    monthlyIncomeCents: 1_200_000,
                    reserveCents: 3_000_000,
                    priorities: [],
                    goalMonths: 12,
                    cryptoExperience: null,
                    onboardingCompleted: true,
                  }
                : url.includes('/households/current')
                  ? {
                      id: 'h1',
                      name: 'Casa',
                      role: 'owner',
                      onboardingCompleted: true,
                      pendingInvites: [],
                    }
                  : url.includes('/lesson-progress')
                    ? []
                    : url.includes('/lessons')
                      ? [{ id: 'beginner-1', title: 'O que é uma carteira', durationMinutes: 4 }]
                      : url.includes('/account')
                        ? {
                            displayName: 'Marina',
                            fullName: 'Marina A.',
                            initials: 'MA',
                            accountType: 'family',
                            household: {
                              id: 'h1',
                              name: 'Casa',
                              role: 'owner',
                              onboardingCompleted: true,
                            },
                          }
                        : {};
        const text = JSON.stringify(body);
        return { status: 200, ok: true, text: async () => text, json: async () => body };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('apaga um gasto da lista', async () => {
    const calls: string[] = [];
    const month = saoPauloMonth();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = init?.method ?? 'GET';
        calls.push(`${method} ${url}`);
        if (method === 'DELETE') {
          return { status: 204, ok: true, text: async () => '', json: async () => null };
        }
        const expense = {
          id: 'e1',
          date: `${month}-12`,
          merchant: 'Padaria Estrela',
          category: 'groceries',
          fixed: false,
          amountCents: 1890,
          addedBy: { displayName: 'Marina', initials: 'MA' },
        };
        const body = url.includes('/expenses/months')
          ? [month]
          : url.includes('/expenses')
            ? { items: [expense], total: 1 }
            : url.includes('/household/summary')
              ? {
                  monthTotalCents: 1890,
                  previousComparableCents: 0,
                  changePercent: null,
                  projectedCents: 1890,
                  leftoverCents: null,
                  byCategory: [],
                  lastSixMonths: [{ month, amountCents: 1890 }],
                  averageCents: 1890,
                  dailyPace: { current: [], previous: [] },
                  fixedVsVariable: [],
                  freedom: null,
                }
              : url.includes('/household/profile')
                ? {
                    householdSize: 'two',
                    monthlyIncomeCents: 1_200_000,
                    reserveCents: 3_000_000,
                    priorities: [],
                    goalMonths: 12,
                    cryptoExperience: null,
                    onboardingCompleted: true,
                  }
                : url.includes('/households/current')
                  ? {
                      id: 'h1',
                      name: 'Casa',
                      role: 'owner',
                      onboardingCompleted: true,
                      pendingInvites: [],
                    }
                  : url.includes('/lesson-progress')
                    ? []
                    : url.includes('/lessons')
                      ? [{ id: 'beginner-1', title: 'O que é uma carteira', durationMinutes: 4 }]
                      : url.includes('/account')
                        ? {
                            displayName: 'Marina',
                            fullName: 'Marina A.',
                            initials: 'MA',
                            accountType: 'family',
                            household: {
                              id: 'h1',
                              name: 'Casa',
                              role: 'owner',
                              onboardingCompleted: true,
                            },
                          }
                        : {};
        const text = JSON.stringify(body);
        return { status: 200, ok: true, text: async () => text, json: async () => body };
      }),
    );

    renderInFamily(<FamilyDashboardPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar Padaria Estrela' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar apagar Padaria Estrela' }));
    await waitFor(() => {
      expect(calls.some((call) => call.startsWith('DELETE') && call.includes('/expenses/e1'))).toBe(true);
    });
  });

  it('abre a trilha ao começar a primeira aula', async () => {
    renderInFamily(<FamilyDashboardPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Começar aula 1' }));
    expect(push).toHaveBeenCalledWith('/aprender?aula=1');
  });

  it('mostra o painel de gastos e não chama a carteira', async () => {
    renderInFamily(<FamilyDashboardPage />);
    expect(screen.getByRole('button', { name: 'Importar extrato' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Convidar')).toBeInTheDocument();
    expect(ensureWallet).not.toHaveBeenCalled();
  });

  it('abre o modal de filtros', async () => {
    renderInFamily(<FamilyDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const dialog = await screen.findByRole('dialog', { name: 'Filtros' });
    expect(within(dialog).getByRole('button', { name: 'Por mês' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('button', { name: 'Todas' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Fixos' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Buscar estabelecimento')).toBeInTheDocument();
  });

  it('não mostra gasto zerado quando a API falha', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    renderInFamily(<FamilyDashboardPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os gastos.');
    expect(screen.queryByText('Primeiro mês importado')).not.toBeInTheDocument();
    expect(screen.queryByText(/R\$ 0,00/)).not.toBeInTheDocument();
  });

  it('abre o modal de extrato com as três formas de trazer gastos', async () => {
    renderInFamily(<FamilyDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Importar extrato' }));
    expect(await screen.findByRole('dialog', { name: 'Traga seus gastos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Extrato do banco/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Nota fiscal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manual/ })).toBeInTheDocument();
  });
});
