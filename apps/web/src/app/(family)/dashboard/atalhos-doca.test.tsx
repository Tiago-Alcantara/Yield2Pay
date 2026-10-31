/**
 * Módulo: atalhos da doca
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: Cada clique no mesmo carregamento reabre o modal, e o convite foca o e-mail.
 * Sequência: importar, novo e conta abrem nas duas vezes; tirar a query não empilha histórico; o convite foca #y2p-invite nos dois cliques.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccountView } from '../_lib/accountStore';
import { resetFamilyStore } from '../_lib/familyStore';
import { Dock } from '../_components/Dock';
import { FamilyProvider } from '../_lib/FamilyProvider';
import PainelGastos from './PainelGastos';

const nativeReplaceState = window.history.replaceState.bind(window.history);
const nativePushState = window.history.pushState.bind(window.history);

const nav = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    search: '',
    listeners,
    emit() {
      for (const listener of [...listeners]) listener();
    },
  };
});

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    usePathname: () => '/dashboard',
    useRouter: () => ({
      push: (href: string) => {
        const url = new URL(href, window.location.origin);
        if (url.pathname === '/dashboard' && url.search === nav.search) return;
        nav.search = url.search;
        nativePushState({ __NA: true }, '', `${url.pathname}${url.search}${url.hash}`);
        nav.emit();
      },
      replace: (href: string) => {
        const url = new URL(href, window.location.origin);
        nav.search = url.search;
        nativeReplaceState({ __NA: true }, '', `${url.pathname}${url.search}`);
        nav.emit();
      },
    }),
    useSearchParams: () => {
      const search = useSyncExternalStore(
        (listener: () => void) => {
          nav.listeners.add(listener);
          return () => nav.listeners.delete(listener);
        },
        () => nav.search,
        () => '',
      );
      return new URLSearchParams(search);
    },
  };
});

const frames: FrameRequestCallback[] = [];
const replaced: unknown[] = [];

function json(body: unknown) {
  const text = JSON.stringify(body);
  return { status: 200, ok: true, text: async () => text, json: async () => body };
}

function installFetch(profile: { showFamily: boolean } = { showFamily: true }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/households/current/people')) return json([]);
      if (url.includes('/account')) {
        return json({
          displayName: 'Marina',
          fullName: 'Marina Alves',
          email: 'marina@email.com',
          initials: 'MA',
          accountType: 'family',
          household: { id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true },
        });
      }
      if (url.includes('/household/profile')) {
        return json({
          householdSize: 'two',
          monthlyIncomeCents: 1_200_000,
          reserveCents: 3_000_000,
          priorities: [],
          goalMonths: 12,
          cryptoExperience: null,
          onboardingCompleted: true,
          importMode: 'ofx',
          showFamily: profile.showFamily,
          showFreedom: true,
        });
      }
      if (url.includes('/households/current')) {
        return json({ id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true, pendingInvites: [] });
      }
      if (url.includes('/expenses/months')) return json([]);
      if (url.includes('/expenses')) return json({ items: [], total: 0 });
      if (url.includes('/household/summary')) {
        return json({
          monthTotalCents: 0,
          previousComparableCents: 0,
          changePercent: null,
          projectedCents: 0,
          leftoverCents: null,
          byCategory: [],
          lastSixMonths: [],
          averageCents: 0,
          dailyPace: { current: [], previous: [] },
          fixedVsVariable: [],
          freedom: null,
        });
      }
      if (url.includes('/lesson-progress') || url.includes('/lessons') || url.includes('/statements')) return json([]);
      return json({});
    }),
  );
}

async function flushFrames() {
  await act(async () => {
    const pending = frames.splice(0, frames.length);
    for (const frame of pending) frame(0);
  });
}

function renderShell() {
  return render(
    <FamilyProvider>
      <PainelGastos />
      <Dock />
    </FamilyProvider>,
  );
}

async function openDialog(press: () => void, name: string) {
  const before = window.history.length;
  press();
  await act(async () => {});
  await flushFrames();
  const dialog = screen.getByRole('dialog', { name });
  expect(window.history.length).toBe(before + 1);
  expect(replaced.some((data) => Boolean(data && typeof data === 'object' && '__NA' in data && (data as { __NA?: boolean }).__NA))).toBe(false);
  return dialog;
}

describe('atalhos da doca no mesmo carregamento', () => {
  beforeEach(() => {
    nav.search = '';
    replaced.length = 0;
    frames.length = 0;
    setAccountView(null);
    resetFamilyStore();
    nativeReplaceState({ __NA: true }, '', '/dashboard');
    window.history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
      replaced.push(data);
      const marked = Boolean(data && typeof data === 'object' && '__NA' in data && (data as { __NA?: boolean }).__NA);
      nativeReplaceState(data, unused, url);
      if (marked || url == null || url === '') return;
      nav.search = new URL(String(url), window.location.href).search;
      nav.emit();
    };
    vi.stubGlobal('scrollTo', vi.fn());
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
    window.history.replaceState = nativeReplaceState;
    vi.unstubAllGlobals();
    nativePushState(null, '', '/');
  });

  it('I-20: dois cliques em importar abrem o extrato nas duas vezes', async () => {
    renderShell();
    const dock = await screen.findByRole('navigation', { name: 'Menu' });
    const button = within(dock).getByRole('button', { name: 'Importar extrato' });
    const first = await openDialog(() => fireEvent.click(button), 'Traga seus gastos');
    expect(within(first).getByRole('button', { name: /Extrato do banco/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(first).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog', { name: 'Traga seus gastos' })).not.toBeInTheDocument();

    const second = await openDialog(() => fireEvent.click(button), 'Traga seus gastos');
    expect(within(second).getByRole('button', { name: /Extrato do banco/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('N-04: dois cliques em novo gasto abrem o manual nas duas vezes', async () => {
    renderShell();
    const button = await screen.findByRole('button', { name: 'Novo gasto' });
    const first = await openDialog(() => fireEvent.click(button), 'Traga seus gastos');
    expect(within(first).getByRole('button', { name: /Manual/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(first).getByRole('button', { name: 'Fechar' }));

    const second = await openDialog(() => fireEvent.click(button), 'Traga seus gastos');
    expect(within(second).getByRole('button', { name: /Manual/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('C-33: dois cliques em configurações do grupo abrem o modal nas duas vezes', async () => {
    renderShell();
    expect(await screen.findByRole('button', { name: 'Filtros' })).toBeInTheDocument();
    const openConta = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Trocar grupo de finanças' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Configurações do grupo' }));
    };
    const first = await openDialog(openConta, 'Configurações');
    fireEvent.click(within(first).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog', { name: 'Configurações' })).not.toBeInTheDocument();

    const second = await openDialog(openConta, 'Configurações');
    expect(second).toBeInTheDocument();
  });

  it('R-07: tirar ?acao e ?conta não aumenta o histórico além do clique', async () => {
    renderShell();
    const button = await screen.findByRole('button', { name: 'Novo gasto' });
    const before = window.history.length;
    await openDialog(() => fireEvent.click(button), 'Traga seus gastos');
    expect(window.history.length).toBe(before + 1);
    expect(new URLSearchParams(window.location.search).get('acao')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('conta')).toBeNull();
  });

  it('CV-07: dois cliques em convidar focam o e-mail nas duas vezes', async () => {
    renderShell();
    const button = await screen.findByRole('button', { name: 'Convidar família' });
    const field = await screen.findByLabelText('Convidar');
    fireEvent.click(button);
    await act(async () => {});
    await flushFrames();
    expect(field).toHaveFocus();
    field.blur();
    expect(field).not.toHaveFocus();

    fireEvent.click(button);
    await act(async () => {});
    await flushFrames();
    expect(field).toHaveFocus();
  });
});
