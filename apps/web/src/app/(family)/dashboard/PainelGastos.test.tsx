/**
 * Módulo: PainelGastos
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: O painel só reage às ações da doca que conhece.
 * Sequência: ?acao=importar abre o extrato; ?acao=novo abre o manual; ?acao=convidar rola até o convite; uma ação desconhecida não abre nada e não aparece na tela.
 */
import { act, render, screen } from '@testing-library/react';
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

describe('ações da doca no painel', () => {
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
    const payload = '"><img src=x onerror=alert(1)>';
    window.history.pushState(null, '', `/dashboard?acao=${encodeURIComponent(payload)}`);
    render(<PainelGastos />);
    await flushFrames();
    expect(await screen.findByRole('button', { name: 'Importar extrato' })).toBeInTheDocument();
    await flushFrames();

    expect(screen.queryByRole('dialog', { name: 'Traga seus gastos' })).not.toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toContain(payload);
    expect(document.body.innerHTML).not.toContain('onerror');
    expect(document.querySelector('img')).toBeNull();
    expect(window.location.search).not.toContain('acao');
    expect(window.location.href).not.toContain('onerror');
  });

  it('tira a query no acesso direto para o reload não reabrir o diálogo', async () => {
    replace.mockImplementation(() => undefined);
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
      view.unmount();
    }
    replace.mockImplementation((next: string) => {
      window.history.replaceState(null, '', next);
    });
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
