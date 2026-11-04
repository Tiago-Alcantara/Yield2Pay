/**
 * Módulo: PainelGastos.entradas
 * Criado em: 2026-11-03
 * Última atualização: 2026-11-03
 * Intuito: O painel mostra Gastos, Entradas e Saldo, e a entrada aparece na lista sem categoria e fora dos números de gasto.
 * Sequência: mostra os três totais, com o sinal e a classe própria da entrada; o saldo negativo usa a classe própria; a API antiga, sem os campos, não vira NaN; a entrada aparece na lista com sinal e sem seletor de categoria; os gráficos e o maior gasto continuam só com gastos; filtrar por Entradas não zera os gastos; com filtro de texto, os totais saem das linhas do mês e ignoram a entrada na soma de gastos; o lançamento manual de entrada chama a API sem categoria.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const searchParams = vi.hoisted(() => new URLSearchParams());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => searchParams,
}));

import PainelGastos from './PainelGastos';

const person = { displayName: 'Ana', initials: 'A' };
const market = {
  id: 'e1',
  date: '2026-10-02',
  merchant: 'Mercado Central',
  kind: 'expense',
  category: 'groceries',
  fixed: false,
  amountCents: 5590,
  excludedFromTotals: false,
  addedBy: person,
};
const salary = {
  id: 'e2',
  date: '2026-10-01',
  merchant: 'Salário da Ana',
  kind: 'income',
  category: null,
  fixed: false,
  amountCents: 500000,
  excludedFromTotals: false,
  addedBy: person,
};

const summary = {
  monthTotalCents: 5590,
  incomeCents: 500000,
  balanceCents: 494410,
  previousComparableCents: 0,
  changePercent: null,
  projectedCents: 5590,
  leftoverCents: 1000,
  byCategory: [{ category: 'groceries', amountCents: 5590 }],
  lastSixMonths: [{ month: '2026-10', amountCents: 5590 }],
  averageCents: 5590,
  dailyPace: { current: [], previous: [] },
  fixedVsVariable: [],
  freedom: null,
};

function respond(url: string, summaryBody: unknown, items: unknown[]) {
  if (url.includes('/account')) {
    return {
      displayName: 'Ana',
      fullName: 'Ana Local',
      email: 'a@example.test',
      initials: 'A',
      accountType: 'family',
      households: [{ id: 'h1', name: 'Casa', role: 'owner', personal: true }],
      activeHousehold: { id: 'h1', name: 'Casa', role: 'owner', personal: true, onboardingCompleted: true },
    };
  }
  if (url.includes('/household/profile')) {
    return { monthlyIncomeCents: 1500000, reserveCents: 3000000, priorities: [], goalMonths: 12, cryptoExperience: 'beginner', onboardingCompleted: true, goals: [], cryptoActions: [], showFreedom: true, showFamily: true };
  }
  if (url.includes('/households/current')) return { id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true, pendingInvites: [] };
  if (url.includes('/expenses/months')) return [{ month: '2026-10', amountCents: 5590 }];
  if (url.includes('/expenses')) return { items, total: items.length };
  if (url.includes('/household/summary')) return summaryBody;
  return [];
}

function installFetch(summaryBody: unknown = summary, items: unknown[] = [market, salary]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body = respond(url, summaryBody, items);
    const text = JSON.stringify(body);
    return { status: 200, ok: true, text: async () => text, json: async () => body } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function openTotals() {
  render(<PainelGastos />);
  return screen.findByRole('group', { name: 'Totais do período' });
}

function totalOf(group: HTMLElement, label: string) {
  const item = within(group).getByText(label).closest('.y2p-totals__item');
  return item?.querySelector('.y2p-totals__value') as HTMLElement;
}

describe('entradas no painel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T15:00:00Z'));
    vi.stubGlobal('scrollTo', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('mostra os três totais, com o sinal e a classe própria da entrada', async () => {
    installFetch();
    const group = await openTotals();

    expect(totalOf(group, 'Gastos')).toHaveTextContent('R$ 55,90');
    expect(totalOf(group, 'Gastos').textContent).not.toContain('+');
    expect(totalOf(group, 'Entradas')).toHaveTextContent('+ R$ 5.000,00');
    expect(totalOf(group, 'Entradas')).toHaveClass('y2p-totals__value--income');
    expect(totalOf(group, 'Saldo')).toHaveTextContent('+ R$ 4.944,10');
    expect(totalOf(group, 'Saldo')).not.toHaveClass('y2p-totals__value--negative');
  });

  it('o saldo negativo usa a classe própria', async () => {
    installFetch({ ...summary, incomeCents: 1000, balanceCents: -4590 }, [market]);
    const group = await openTotals();

    expect(totalOf(group, 'Saldo')).toHaveTextContent('− R$ 45,90');
    expect(totalOf(group, 'Saldo')).toHaveClass('y2p-totals__value--negative');
  });

  it('a API antiga, sem os campos, não vira NaN', async () => {
    const { incomeCents: _income, balanceCents: _balance, ...old } = summary;
    installFetch(old, [{ ...market, kind: undefined, excludedFromTotals: undefined }]);
    const group = await openTotals();

    expect(totalOf(group, 'Entradas')).toHaveTextContent('R$ 0,00');
    expect(totalOf(group, 'Saldo')).toHaveTextContent('− R$ 55,90');
    expect(group.textContent).not.toContain('NaN');
  });

  it('a entrada aparece na lista com sinal e sem seletor de categoria', async () => {
    installFetch();
    await openTotals();

    const row = screen.getByText('Salário da Ana').closest('.y2p-tx') as HTMLElement;
    expect(within(row).getByText('Entrada')).toHaveClass('y2p-tx__kind');
    expect(within(row).getByText('+ R$ 5.000,00')).toHaveClass('y2p-tx__amount--income');
    expect(within(row).queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Categoria de Mercado Central' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lançamentos de outubro' })).toBeInTheDocument();
    expect(screen.getByText('2 lançamentos · gastos R$ 55,90 · entradas + R$ 5.000,00')).toBeInTheDocument();
  });

  it('sem entrada, o título e a soma da lista são os de sempre', async () => {
    installFetch(summary, [market]);
    await openTotals();

    expect(screen.getByRole('heading', { name: 'Gastos de outubro' })).toBeInTheDocument();
    expect(screen.getByText('1 gasto · R$ 55,90')).toBeInTheDocument();
  });

  it('o gasto excluído aparece na lista e fica fora da soma', async () => {
    installFetch(summary, [market, { ...market, id: 'e3', merchant: 'Transferência', amountCents: 99900, excludedFromTotals: true }]);
    await openTotals();

    expect(screen.getByText('Transferência')).toBeInTheDocument();
    expect(screen.getByText('2 gastos · R$ 55,90')).toBeInTheDocument();
  });

  it('os gráficos e o maior gasto continuam só com gastos', async () => {
    installFetch();
    await openTotals();

    const stat = screen.getByText('Maior categoria').closest('.y2p-stat') as HTMLElement;
    expect(within(stat).getByText('Mercado')).toBeInTheDocument();
    expect(within(stat).getByText(/R\$ 56 · 100% do mês/)).toBeInTheDocument();
    expect(screen.getByText('Gasto até dia 15').parentElement).toHaveTextContent('R$ 55,90');
  });

  it('filtrar por Entradas mostra só elas e não zera os gastos', async () => {
    installFetch();
    const group = await openTotals();

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtros' });
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Tipo de lançamento' })).getByRole('button', { name: 'Entradas' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mostrar 1 entrada' }));

    expect(await screen.findByRole('heading', { name: 'Entradas de outubro' })).toBeInTheDocument();
    expect(screen.queryByText('Mercado Central')).not.toBeInTheDocument();
    expect(screen.getByText('1 entrada · + R$ 5.000,00')).toBeInTheDocument();
    expect(totalOf(group, 'Gastos')).toHaveTextContent('R$ 55,90');
    expect(totalOf(group, 'Entradas')).toHaveTextContent('+ R$ 5.000,00');
    expect(screen.getByRole('button', { name: 'Remover filtro Só entradas' })).toBeInTheDocument();
  });

  it('com filtro de texto, os totais saem das linhas e a entrada fica fora dos gastos', async () => {
    installFetch();
    await openTotals();

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtros' });
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Buscar estabelecimento' }), { target: { value: 'salario' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mostrar 1 entrada' }));

    const group = await screen.findByRole('group', { name: 'Totais do período' });
    await waitFor(() => expect(totalOf(group, 'Gastos')).toHaveTextContent('R$ 0,00'));
    expect(totalOf(group, 'Entradas')).toHaveTextContent('+ R$ 5.000,00');
    expect(totalOf(group, 'Saldo')).toHaveTextContent('+ R$ 5.000,00');
  });

  it('o lançamento manual de entrada chama a API sem categoria', async () => {
    const fetchMock = installFetch();
    await openTotals();

    fireEvent.click(screen.getByRole('button', { name: 'Importar extrato' }));
    const dialog = await screen.findByRole('dialog', { name: 'Traga seus gastos' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Manual/ }));
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Tipo do lançamento' })).getByRole('button', { name: 'Entrada' }));
    fireEvent.change(within(dialog).getByLabelText('Onde'), { target: { value: 'Freela' } });
    fireEvent.change(within(dialog).getByLabelText('Valor'), { target: { value: '100,00' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar entrada' }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/expenses') && init?.method === 'POST');
      expect(post).toBeTruthy();
      expect(JSON.parse(String(post?.[1]?.body))).toEqual({
        merchant: 'Freela',
        amountCents: 10000,
        spentOn: '2026-10-15',
        kind: 'income',
      });
    });
  });
});
