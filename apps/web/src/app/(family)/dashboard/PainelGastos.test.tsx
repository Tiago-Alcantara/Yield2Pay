/**
 * Módulo: PainelGastos
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: Abrir o painel faz no máximo duas ondas e uma /expenses por mês, e o erro aparece na tela.
 * Sequência: opens in two waves with one expenses call; switching month does not reload the house; a failed load shows the error.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import PainelGastos from './PainelGastos';

const expense = {
  id: 'e1',
  date: '2026-10-02',
  merchant: 'Netflix',
  category: 'subscriptions',
  fixed: true,
  amountCents: 5590,
  addedBy: { displayName: 'Ana', initials: 'A' },
};

const summary = {
  monthTotalCents: 5590,
  previousComparableCents: 0,
  changePercent: null,
  projectedCents: 5590,
  leftoverCents: 1000,
  byCategory: [{ category: 'subscriptions', amountCents: 5590 }],
  lastSixMonths: [],
  averageCents: 5590,
  dailyPace: { current: [], previous: [] },
  fixedVsVariable: [],
  freedom: null,
};

function payload(url: string) {
  if (url.includes('/account')) {
    return {
      displayName: 'Ana',
      fullName: 'Ana Local',
      email: 'familia@localhost',
      initials: 'A',
      accountType: 'family',
      household: { id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true },
    };
  }
  if (url.includes('/household/profile')) {
    return {
      householdSize: null,
      monthlyIncomeCents: 1500000,
      reserveCents: 3000000,
      priorities: [],
      goalMonths: 12,
      cryptoExperience: 'beginner',
      onboardingCompleted: true,
      goals: [],
      importMode: null,
      cryptoFamiliarity: null,
      cryptoActions: [],
      showFreedom: true,
      showFamily: true,
    };
  }
  if (url.includes('/households/current')) {
    return { id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true, pendingInvites: [] };
  }
  if (url.includes('/expenses/months')) {
    return [
      { month: '2026-09', amountCents: 1000 },
      { month: '2026-10', amountCents: 5590 },
    ];
  }
  if (url.includes('/expenses')) {
    const month = new URL(url, 'http://local').searchParams.get('month');
    return {
      items: [{ ...expense, id: month ?? 'e1', date: `${month ?? '2026-10'}-02` }],
      total: 1,
    };
  }
  if (url.includes('/household/summary')) return summary;
  if (url.includes('/lesson-progress')) return [];
  if (url.includes('/lessons')) return [];
  return {};
}

describe('PainelGastos', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens in two waves with one expenses call and switches month without reloading the house', async () => {
    const calls: { url: string; at: number }[] = [];
    let releaseAccount: () => void = () => undefined;
    const accountGate = new Promise<void>((resolve) => {
      releaseAccount = resolve;
    });
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const target = String(url);
      calls.push({ url: target, at: performance.now() });
      const body = JSON.stringify(payload(target));
      if (target.includes('/account')) {
        return accountGate.then(() => new Response(body, { status: 200 }));
      }
      return Promise.resolve(new Response(body, { status: 200 }));
    }));

    render(<PainelGastos />);
    await waitFor(() => expect(calls.some((call) => call.url.includes('/account'))).toBe(true));
    expect(calls.every((call) => call.url.includes('/account'))).toBe(true);
    releaseAccount();
    await screen.findByText('Netflix');

    const expenseCalls = calls.filter((call) => /\/expenses\?/.test(call.url));
    expect(expenseCalls).toHaveLength(1);
    expect(expenseCalls[0]?.url).toContain('month=');
    const afterAccount = calls.filter((call) => !call.url.includes('/account'));
    expect(afterAccount.length).toBeGreaterThan(1);
    const firstWaveDone = calls.find((call) => call.url.includes('/account'))!.at;
    expect(afterAccount.every((call) => call.at >= firstWaveDone)).toBe(true);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await waitFor(() => {
      expect(calls.filter((call) => /\/expenses\?/.test(call.url))).toHaveLength(2);
    });
    expect(screen.getByRole('heading', { name: 'Gastos de setembro' })).toBeTruthy();
    const expenseCallsAfter = calls.filter((call) => /\/expenses\?/.test(call.url));
    expect(expenseCallsAfter).toHaveLength(2);
    expect(calls.filter((call) => call.url.includes('/account'))).toHaveLength(1);
    expect(calls.filter((call) => call.url.includes('/household/profile'))).toHaveLength(1);
  });

  it('shows the load error without an extra wait', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    const started = performance.now();
    render(<PainelGastos />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Não foi possível carregar/);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('shows the load error within 9s when account is slow and expenses hang', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      const target = String(url);
      if (target.includes('/account')) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(new Response(JSON.stringify(payload(target)), { status: 200 })), 7500);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(init.signal?.reason ?? Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      }
      if (target.includes('/expenses?')) {
        return new Promise((_resolve, reject) => {
          const fail = () => reject(init?.signal?.reason ?? Object.assign(new Error('aborted'), { name: 'AbortError' }));
          if (init?.signal?.aborted) fail();
          else init?.signal?.addEventListener('abort', fail, { once: true });
        });
      }
      return Promise.resolve(new Response(JSON.stringify(payload(target)), { status: 200 }));
    }));
    const started = performance.now();
    render(<PainelGastos />);
    const alert = await screen.findByRole('alert', {}, { timeout: 12_000 });
    const elapsed = performance.now() - started;
    expect(alert.textContent).toMatch(/Não foi possível carregar/);
    expect(elapsed).toBeGreaterThan(7_000);
    expect(elapsed).toBeLessThan(9_000);
  }, 15_000);

  it('reloads another month after a write that can change its fixed flag', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      const target = String(url);
      calls.push(`${init?.method ?? 'GET'} ${target}`);
      if (init?.method === 'PATCH') {
        return Promise.resolve(new Response(JSON.stringify({ ...expense, category: 'groceries' }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify(payload(target)), { status: 200 }));
    }));
    const user = userEvent.setup();
    render(<PainelGastos />);
    await screen.findByText('Netflix');
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await screen.findByRole('heading', { name: 'Gastos de setembro' });
    const before = calls.filter((call) => call.includes('/expenses?')).length;
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await screen.findByRole('heading', { name: 'Gastos de outubro' });
    expect(calls.filter((call) => call.includes('/expenses?'))).toHaveLength(before);
    await user.selectOptions(screen.getByLabelText('Categoria de Netflix'), 'groceries');
    await waitFor(() => {
      expect(calls.filter((call) => call.includes('/expenses?')).length).toBeGreaterThan(before);
    });
    const afterWrite = calls.filter((call) => call.includes('/expenses?')).length;
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await screen.findByRole('heading', { name: 'Gastos de setembro' });
    await waitFor(() => {
      expect(calls.filter((call) => call.includes('/expenses?')).length).toBeGreaterThan(afterWrite);
    });
  });

  it('warns when a custom range is cut at 36 months', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const target = String(url);
      if (target.includes('/expenses/months')) {
        return Promise.resolve(new Response(JSON.stringify([
          { month: '2023-01', amountCents: 1000 },
          { month: '2026-10', amountCents: 5590 },
        ]), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify(payload(target)), { status: 200 }));
    }));
    const user = userEvent.setup();
    render(<PainelGastos />);
    await screen.findByText('Netflix');
    await user.click(screen.getByRole('button', { name: /outubro 2026/i }));
    await user.click(screen.getByRole('button', { name: /Período personalizado/i }));
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2023-01-01' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-30' } });
    await user.click(screen.getByRole('button', { name: /Mostrar/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Mostramos só os primeiros 36 meses deste período.');
  });
});
