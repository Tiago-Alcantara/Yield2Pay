/**
 * Módulo: PainelGastos
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-31
 * Intuito: A carga do painel faz no máximo duas ondas e uma /expenses por mês, e a doca só abre as ações conhecidas.
 * Sequência: opens in two waves with one expenses call; switching month does not reload the house; a failed load shows the error; ?acao=importar abre o extrato; ?acao=novo abre o manual; ?acao=convidar rola até o convite; ?conta=1 abre as configurações; uma ação desconhecida não abre nada e não aparece na tela.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saoPauloMonth } from './painel-format';

const push = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn((url: string) => {
  window.history.replaceState(null, '', url);
}));
const searchBox = vi.hoisted(() => ({ value: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/dashboard',
  useSearchParams: () => {
    const next = new URLSearchParams(window.location.search);
    if (next.toString() !== searchBox.value.toString()) searchBox.value = next;
    return searchBox.value;
  },
}));

import PainelGastos from './PainelGastos';

const frames: FrameRequestCallback[] = [];
const scrollTo = vi.fn();

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

function installFetch() {
  const month = saoPauloMonth();
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
                  importMode: 'ofx',
                  showFamily: true,
                  showFreedom: true,
                }
              : url.includes('/households/current')
                ? { id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true, pendingInvites: [] }
                : url.includes('/account')
                  ? {
                      displayName: 'Marina',
                      fullName: 'Marina Alves',
                      email: 'marina@email.com',
                      initials: 'MA',
                      accountType: 'family',
                      household: { id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true },
                    }
                  : url.includes('/lesson-progress')
                    ? []
                    : url.includes('/lessons')
                      ? [{ id: 'beginner-1', title: 'O que é uma carteira', durationMinutes: 4 }]
                      : url.includes('/statements')
                        ? []
                        : {};
      const text = JSON.stringify(body);
      return { status: 200, ok: true, text: async () => text, json: async () => body };
    }),
  );
}

async function flushFrames() {
  await act(async () => {
    const pending = frames.splice(0, frames.length);
    for (const frame of pending) frame(0);
  });
}

describe('ações da doca no painel', () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    searchBox.value = new URLSearchParams('stale');
    scrollTo.mockClear();
    frames.length = 0;
    localStorage.clear();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      if (id >= 1 && id <= frames.length) frames[id - 1] = () => undefined;
    });
    installFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState(null, '', '/');
  });

  it('abre o extrato ao ler ?acao=importar e preserva o resto da query', async () => {
    window.history.pushState(null, '', '/dashboard?origem=doca&acao=importar');
    render(<PainelGastos />);
    await flushFrames();

    expect(await screen.findByRole('dialog', { name: 'Traga seus gastos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Extrato do banco/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Manual/ })).toHaveAttribute('aria-pressed', 'false');
    const params = new URLSearchParams(window.location.search);
    expect(params.get('acao')).toBeNull();
    expect(params.get('origem')).toBe('doca');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('abre o lançamento manual ao ler ?acao=novo', async () => {
    window.history.pushState(null, '', '/dashboard?acao=novo');
    render(<PainelGastos />);
    await flushFrames();

    expect(await screen.findByRole('dialog', { name: 'Traga seus gastos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manual/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Extrato do banco/ })).toHaveAttribute('aria-pressed', 'false');
    expect(new URLSearchParams(window.location.search).get('acao')).toBeNull();
  });

  it('rola até o convite ao ler ?acao=convidar, mesmo que a seção ainda não exista', async () => {
    window.history.pushState(null, '', '/dashboard?acao=convidar');
    render(<PainelGastos />);
    await flushFrames();
    expect(scrollTo).not.toHaveBeenCalled();

    expect(await screen.findByLabelText('Convidar')).toBeInTheDocument();
    await flushFrames();

    expect(screen.queryByRole('dialog', { name: 'Traga seus gastos' })).not.toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).get('acao')).toBeNull();
  });

  it('ignora uma ação desconhecida e não a escreve na tela', async () => {
    const payloadText = '"><img src=x onerror=alert(1)>';
    window.history.pushState(null, '', `/dashboard?acao=${encodeURIComponent(payloadText)}`);
    render(<PainelGastos />);
    await flushFrames();
    expect(await screen.findByRole('button', { name: 'Importar extrato' })).toBeInTheDocument();
    await flushFrames();

    expect(screen.queryByRole('dialog', { name: 'Traga seus gastos' })).not.toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toContain(payloadText);
    expect(document.body.innerHTML).not.toContain('onerror');
    expect(document.querySelector('img')).toBeNull();
    expect(window.location.search).not.toContain('acao');
    expect(window.location.href).not.toContain('onerror');
  });

  it('tira a query no acesso direto para o reload não reabrir o diálogo', async () => {
    replace.mockImplementation(() => undefined);
    try {
      const cases = [
        ['/dashboard?acao=novo', 'Traga seus gastos'],
        ['/dashboard?acao=importar', 'Traga seus gastos'],
        ['/dashboard?conta=1', 'Configurações'],
      ] as const;
      for (const [url, name] of cases) {
        window.history.pushState(null, '', url);
        const view = render(<PainelGastos />);
        await flushFrames();
        expect(await screen.findByRole('dialog', { name })).toBeInTheDocument();
        expect(new URLSearchParams(window.location.search).get('acao')).toBeNull();
        expect(new URLSearchParams(window.location.search).get('conta')).toBeNull();
        expect(replace).not.toHaveBeenCalled();
        view.unmount();
        replace.mockClear();
      }
    } finally {
      replace.mockImplementation((next: string) => {
        window.history.replaceState(null, '', next);
      });
    }
  });

  it('ignora ?acao=NOVO em maiúsculas', async () => {
    window.history.pushState(null, '', '/dashboard?acao=NOVO');
    render(<PainelGastos />);
    await flushFrames();
    expect(await screen.findByRole('button', { name: 'Filtros' })).toBeInTheDocument();
    await flushFrames();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).get('acao')).toBeNull();
  });

  it('ignora ação com espaço no fim', async () => {
    window.history.pushState(null, '', '/dashboard?acao=novo%20');
    render(<PainelGastos />);
    await flushFrames();
    expect(await screen.findByRole('button', { name: 'Filtros' })).toBeInTheDocument();
    await flushFrames();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('abre o extrato se ?acao=importar chegar com o painel já montado', async () => {
    window.history.pushState(null, '', '/dashboard');
    const view = render(<PainelGastos />);
    expect(await screen.findByRole('button', { name: 'Filtros' })).toBeInTheDocument();
    await flushFrames();
    expect(screen.queryByRole('dialog', { name: 'Traga seus gastos' })).not.toBeInTheDocument();

    act(() => {
      window.history.pushState(null, '', '/dashboard?acao=importar');
    });
    view.rerender(<PainelGastos />);
    await flushFrames();

    expect(await screen.findByRole('dialog', { name: 'Traga seus gastos' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Configurações' })[0]?.getAttribute('style')).toContain('--fam-avatar');
  });

  it('abre as configurações se ?conta=1 chegar com o painel já montado', async () => {
    window.history.pushState(null, '', '/dashboard');
    const view = render(<PainelGastos />);
    expect(await screen.findByRole('button', { name: 'Filtros' })).toBeInTheDocument();
    act(() => {
      window.history.pushState(null, '', '/dashboard?conta=1');
    });
    view.rerender(<PainelGastos />);
    await flushFrames();
    expect(await screen.findByRole('dialog', { name: 'Configurações' })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('conta')).toBeNull();
  });

  it('avisa quem não administra a casa em vez de ignorar o convite', async () => {
    window.history.pushState(null, '', '/dashboard?acao=convidar');
    const month = saoPauloMonth();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const body = url.includes('/account')
          ? {
              displayName: 'Marina',
              fullName: 'Marina Alves',
              email: 'marina@email.com',
              initials: 'MA',
              accountType: 'family',
              household: { id: 'h1', name: 'Casa', role: 'member', onboardingCompleted: true },
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
                importMode: 'ofx',
                showFamily: true,
                showFreedom: true,
              }
            : url.includes('/households/current')
              ? { id: 'h1', name: 'Casa', role: 'member', onboardingCompleted: true, pendingInvites: [] }
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
                    : url.includes('/lesson-progress')
                      ? []
                      : url.includes('/lessons')
                        ? []
                        : [];
        const text = JSON.stringify(body);
        return { status: 200, ok: true, text: async () => text, json: async () => body };
      }),
    );
    render(<PainelGastos />);
    expect(await screen.findByText('Olá, Marina')).toBeInTheDocument();
    await flushFrames();
    expect(screen.getByRole('status')).toHaveTextContent('Só quem administra a casa pode convidar.');
    expect(screen.queryByRole('dialog', { name: 'Traga seus gastos' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Convidar')).not.toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

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
