/**
 * Módulo: carregamento do painel
 * Criado em: 2026-11-03
 * Última atualização: 2026-11-03
 * Intuito: O skeleton troca só o conteúdo de #s-topo, sem quebrar hash, doca, erro nem modais.
 * Sequência: skeleton sem âncoras e com cabeçalho real; conteúdo em onda; erro e "Tentar de novo"; /dashboard#s-gastos rola depois da carga; trocar de mês não rola; clique na doca durante o skeleton rola no fim; atalhos da doca funcionam no skeleton; convite foca no fim da carga do mês; CSS segue o tema.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dock } from '../_components/Dock';
import { resetAppSplash } from '../_components/loading/AppSplash';
import { setAccountView } from '../_lib/accountStore';
import { FamilyProvider } from '../_lib/FamilyProvider';
import { resetFamilyStore } from '../_lib/familyStore';
import PainelGastos from './PainelGastos';

const nativePushState = window.history.pushState.bind(window.history);
const nativeReplaceState = window.history.replaceState.bind(window.history);

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
        nav.search = url.search;
        nativePushState(null, '', `${url.pathname}${url.search}${url.hash}`);
        nav.emit();
      },
      replace: vi.fn(),
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

// Next faz o scroll da âncora por conta própria; aqui só o Link muda a URL.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        event.preventDefault();
        nativePushState(null, '', href);
      }}
    >
      {children}
    </a>
  ),
}));

const frames: FrameRequestCallback[] = [];
const scrollTo = vi.fn();

const profileBody = {
  householdSize: 'two',
  monthlyIncomeCents: 1_200_000,
  reserveCents: 3_000_000,
  priorities: [],
  goalMonths: 12,
  cryptoExperience: 'beginner',
  onboardingCompleted: true,
  goals: [],
  importMode: 'ofx',
  showFamily: true,
  showFreedom: true,
};

const summaryBody = {
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
};

function respond(url: string) {
  if (url.includes('/account')) {
    return {
      displayName: 'Marina',
      fullName: 'Marina Alves',
      email: 'marina@email.com',
      initials: 'MA',
      accountType: 'family',
      households: [{ id: 'h1', name: 'Casa', role: 'owner', personal: true }],
      activeHousehold: { id: 'h1', name: 'Casa', role: 'owner', personal: true, onboardingCompleted: true },
    };
  }
  if (url.includes('/household/profile')) return profileBody;
  if (url.includes('/households/current')) return { id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true, pendingInvites: [] };
  if (url.includes('/expenses/months')) return [{ month: '2026-09', amountCents: 1000 }, { month: '2026-10', amountCents: 1000 }];
  if (url.includes('/expenses')) return { items: [], total: 0 };
  if (url.includes('/household/summary')) return summaryBody;
  if (url.includes('/lesson-progress') || url.includes('/lessons') || url.includes('/statements')) return [];
  return {};
}

function reply(url: string) {
  return new Response(JSON.stringify(respond(url)), { status: 200 });
}

/** Sem portão, responde na hora. Com portão, as consultas de um mês esperam o release. */
function installFetch(options: { failFirst?: boolean; holdMonth?: Promise<void>; month?: string; hold?: Promise<void> } = {}) {
  let failures = options.failFirst ? 1 : 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (failures > 0 && url.includes('/account')) {
        failures -= 1;
        return new Response('{}', { status: 500 });
      }
      if (options.hold) await options.hold;
      if (options.holdMonth && options.month && url.includes(`month=${options.month}`)) await options.holdMonth;
      return reply(url);
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

async function pickPreviousMonth(month: string) {
  const header = document.getElementById('painel-header') as HTMLElement;
  const previous = within(header).getAllByRole('button').find((button) => /anterior/i.test(button.getAttribute('aria-label') ?? ''));
  expect(previous, `seta do mês anterior até ${month}`).toBeTruthy();
  fireEvent.click(previous as HTMLElement);
  await waitFor(() => expect(document.getElementById('s-topo')).toHaveAttribute('aria-busy', 'true'));
}

function deferred() {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('carregamento do painel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T15:00:00Z'));
    nav.search = '';
    frames.length = 0;
    scrollTo.mockClear();
    setAccountView(null);
    resetFamilyStore();
    nativeReplaceState(null, '', '/dashboard');
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      if (id >= 1 && id <= frames.length) frames[id - 1] = () => undefined;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    nativeReplaceState(null, '', '/');
  });

  it('durante a carga, #s-topo tem skeleton sem âncoras e o cabeçalho continua real', async () => {
    const gate = deferred();
    installFetch({ hold: gate.promise });
    renderShell();
    const topo = document.getElementById('s-topo') as HTMLElement;
    expect(topo).toHaveAttribute('aria-busy', 'true');
    expect(topo.querySelectorAll('.y2p-ld-sk').length).toBeGreaterThan(0);
    expect(within(topo).getByText('Carregando seus gastos…')).toBeInTheDocument();
    for (const id of ['s-liberdade', 's-gastos', 's-aprender', 's-convidar']) {
      expect(document.getElementById(id)).toBeNull();
    }
    expect(document.getElementById('painel-header')?.querySelector('.y2p-ld-sk')).toBeNull();
    expect(within(document.getElementById('painel-header') as HTMLElement).getByRole('button', { name: 'Filtros' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Menu' }).querySelector('.y2p-ld-sk')).toBeNull();
    gate.release();
    expect(await screen.findByRole('heading', { level: 1, name: 'Casa' })).toBeInTheDocument();
  });

  it('o conteúdo volta com as âncoras e entra em onda', async () => {
    installFetch();
    renderShell();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    const topo = document.getElementById('s-topo') as HTMLElement;
    expect(topo).toHaveAttribute('aria-busy', 'false');
    expect(topo.querySelector('.y2p-ld-sk')).toBeNull();
    expect(topo.querySelector('.y2p-ld-wave')).not.toBeNull();
    for (const id of ['s-gastos', 's-aprender', 's-convidar']) {
      expect(document.getElementById(id)).toHaveAttribute('data-reveal');
    }
    expect(document.getElementById('s-gastos')).toHaveAttribute('data-screen-label', 'Gastos');
    expect(document.getElementById('s-aprender')).toHaveAttribute('data-screen-label', 'Aprender');
    expect(document.getElementById('s-liberdade')).toHaveAttribute('data-screen-label', 'Liberdade');
  });

  it('o erro mostra "Tentar de novo", e o clique volta ao skeleton e depois ao conteúdo', async () => {
    installFetch({ failFirst: true });
    renderShell();
    const retry = await screen.findByRole('button', { name: 'Tentar de novo' });
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os gastos.');
    expect(document.getElementById('s-topo')?.querySelector('.y2p-ld-sk')).toBeNull();
    const gate = deferred();
    installFetch({ hold: gate.promise });
    fireEvent.click(retry);
    expect(document.getElementById('s-topo')?.querySelector('.y2p-ld-sk')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    gate.release();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('/dashboard#s-gastos rola até a lista só depois de carregar', async () => {
    const gate = deferred();
    installFetch({ hold: gate.promise });
    nativeReplaceState(null, '', '/dashboard#s-gastos');
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = this.id === 's-gastos' ? 900 : 0;
      return { x: 0, y: top, top, left: 0, right: 0, bottom: top, width: 0, height: 0, toJSON: () => ({}) } as DOMRect;
    });
    renderShell();
    await flushFrames();
    expect(document.getElementById('s-gastos')).toBeNull();
    expect(scrollTo).not.toHaveBeenCalled();
    gate.release();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    await flushFrames();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 900 - 12, behavior: 'smooth' });
    rect.mockRestore();
  });

  it('com a primeira carga em erro, o hash rola depois de "Tentar de novo"', async () => {
    installFetch({ failFirst: true });
    nativeReplaceState(null, '', '/dashboard#s-gastos');
    renderShell();
    const retry = await screen.findByRole('button', { name: 'Tentar de novo' });
    await flushFrames();
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.click(retry);
    await waitFor(() => expect(document.getElementById('s-topo')).toHaveAttribute('aria-busy', 'false'));
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    await flushFrames();
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('trocar de mês com #s-gastos na URL não move a página', async () => {
    const gate = deferred();
    installFetch({ holdMonth: gate.promise, month: '2026-09' });
    nativeReplaceState(null, '', '/dashboard#s-gastos');
    renderShell();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    // A seção aparece antes do efeito que agenda o frame da rolagem.
    await waitFor(async () => {
      await flushFrames();
      expect(scrollTo).toHaveBeenCalledTimes(1);
    });
    await pickPreviousMonth('2026-09');
    gate.release();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    await flushFrames();
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('o atalho Gastos clicado durante o skeleton rola no fim da carga', async () => {
    const gate = deferred();
    installFetch({ holdMonth: gate.promise, month: '2026-09' });
    renderShell();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    await flushFrames();
    expect(scrollTo).not.toHaveBeenCalled();
    await pickPreviousMonth('2026-09');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Menu' })).getByRole('link', { name: 'Gastos' }));
    expect(window.location.hash).toBe('#s-gastos');
    gate.release();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    await flushFrames();
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('o atalho de novo gasto abre o modal mesmo com o skeleton na tela', async () => {
    const gate = deferred();
    installFetch({ hold: gate.promise });
    renderShell();
    fireEvent.click(await screen.findByRole('button', { name: 'Novo gasto' }));
    await act(async () => {});
    await flushFrames();
    const dialog = screen.getByRole('dialog', { name: 'Traga seus gastos' });
    expect(within(dialog).getByRole('button', { name: /Manual/ })).toHaveAttribute('aria-pressed', 'true');
    expect(document.getElementById('s-topo')?.querySelector('.y2p-ld-sk')).not.toBeNull();
    gate.release();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    expect(screen.getByRole('dialog', { name: 'Traga seus gastos' })).toBeInTheDocument();
  });

  it('o atalho de convidar clicado na carga de outro mês foca o e-mail quando o campo volta', async () => {
    const gate = deferred();
    installFetch({ holdMonth: gate.promise, month: '2026-09' });
    renderShell();
    const button = await screen.findByRole('button', { name: 'Convidar família' });
    await screen.findByLabelText('Convidar');
    await pickPreviousMonth('2026-09');
    expect(document.getElementById('y2p-invite')).toBeNull();
    fireEvent.click(button);
    await act(async () => {});
    await flushFrames();
    gate.release();
    const field = await screen.findByLabelText('Convidar');
    // O quadro do foco é agendado num efeito: repete até ele rodar.
    for (let attempt = 0; attempt < 50 && document.activeElement !== field; attempt++) {
      await flushFrames();
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    }
    expect(field).toHaveFocus();
  });

  it('o splash cobre a primeira carga e não volta na mesma sessão', async () => {
    sessionStorage.clear();
    resetAppSplash();
    const gate = deferred();
    installFetch({ hold: gate.promise });
    const first = renderShell();
    expect(screen.getByText('Preparando seu painel')).toBeInTheDocument();
    gate.release();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    first.unmount();
    sessionStorage.setItem('y2p-splash-visto', '1');
    installFetch();
    renderShell();
    expect(screen.queryByText('Preparando seu painel')).not.toBeInTheDocument();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
  });

  it('no desktop, cabeçalho e conteúdo usam a mesma margem, sem teto de largura', async () => {
    installFetch();
    renderShell();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    const header = document.getElementById('painel-header')?.getAttribute('style') ?? '';
    const topo = document.getElementById('s-topo')?.getAttribute('style') ?? '';
    expect(header).toContain('padding: 16px var(--y2p-gutter)');
    expect(topo).toContain('padding: 32px var(--y2p-gutter)');
    expect(topo).toContain('max-width: none');
  });

  it('no celular, cabeçalho e conteúdo ficam como antes', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    installFetch();
    renderShell();
    await waitFor(() => expect(document.getElementById('s-gastos')).not.toBeNull());
    expect(document.getElementById('painel-header')?.getAttribute('style') ?? '').toContain('padding: 12px 16px');
    const topo = document.getElementById('s-topo') as HTMLElement;
    expect(topo.hasAttribute('style')).toBe(false);
    expect(topo).toHaveClass('y2p-page');
  });

  it('o CSS define a margem de 24px a 120px', () => {
    const relative = 'src/app/(family)/_components/loading/loading.css';
    const cssPath = join(process.cwd(), relative);
    const css = readFileSync(existsSync(cssPath) ? cssPath : join(process.cwd(), 'apps/web', relative), 'utf8');
    expect(css).toContain('--y2p-gutter: clamp(24px, 6vw, 120px);');
  });

  it('o CSS deriva as cores do skeleton em .fam-shell, onde os temas trocam --fx-text', () => {
    const relative = 'src/app/(family)/_components/loading/loading.css';
    const cssPath = join(process.cwd(), relative);
    const css = readFileSync(existsSync(cssPath) ? cssPath : join(process.cwd(), 'apps/web', relative), 'utf8');
    const rootBlock = css.match(/:root\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rootBlock).not.toContain('--y2p-sk-base');
    expect(css).toMatch(/\.fam-shell\s*\{[^}]*--y2p-sk-base:\s*color-mix\(in srgb, var\(--fx-text/);
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*\.y2p-ld-sk \{ animation: none/);
  });
});
