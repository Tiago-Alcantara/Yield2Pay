/**
 * Módulo: TopProgress
 * Criado em: 2026-11-03
 * Última atualização: 2026-11-03
 * Intuito: A barra acompanha fetch e troca de rota, sem ficar presa quando o pathname não muda.
 * Sequência: fetch liga e desliga; duas cargas esperam a última; push para outro pathname liga e a troca desliga; mesmo pathname não liga; clique em link interno liga; âncora na mesma tela não liga; encerra sozinha em 12s e libera a próxima navegação.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopProgressProvider, useTopProgress } from './TopProgress';

const nav = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

const captured = { api: { start: () => {}, done: () => {}, startNavigation: () => {} } as ReturnType<typeof useTopProgress> };

function Capture() {
  const value = useTopProgress();
  useEffect(() => {
    captured.api = value;
  }, [value]);
  return null;
}

function Tree() {
  return (
    <TopProgressProvider>
      <Capture />
    </TopProgressProvider>
  );
}

// O listener da barra fica no document: basta um link qualquer na página.
function appendLink(href: string) {
  const link = document.createElement('a');
  link.href = href;
  link.addEventListener('click', (event) => event.preventDefault());
  document.body.appendChild(link);
  return link;
}

const bar = () => document.querySelector('.y2p-ld-top') as HTMLElement;
const isRunning = () => bar().style.opacity === '1' && bar().style.width === '78%';

describe('TopProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    nav.pathname = '/dashboard';
    window.history.pushState(null, '', '/dashboard');
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.pushState(null, '', '/');
  });

  it('liga no start e some depois do done', () => {
    render(<Tree />);
    act(() => captured.api.start());
    expect(isRunning()).toBe(true);
    act(() => captured.api.done());
    expect(bar().style.width).toBe('100%');
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(bar().style.opacity).toBe('0');
  });

  it('com duas cargas, espera a última terminar', () => {
    render(<Tree />);
    act(() => {
      captured.api.start();
      captured.api.start();
      captured.api.done();
    });
    expect(isRunning()).toBe(true);
    act(() => captured.api.done());
    expect(bar().style.width).toBe('100%');
  });

  it('router.push para outro pathname liga, e a troca de rota desliga', () => {
    const { rerender } = render(<Tree />);
    act(() => captured.api.startNavigation('/aprender'));
    expect(isRunning()).toBe(true);
    nav.pathname = '/aprender';
    rerender(<Tree />);
    expect(bar().style.width).toBe('100%');
  });

  it('atalho no mesmo pathname não liga: nada desligaria a barra antes dos 12s', () => {
    render(<Tree />);
    act(() => captured.api.startNavigation('/dashboard?acao=importar'));
    expect(bar().style.opacity).not.toBe('1');
  });

  it('clique em link interno liga; âncora na mesma tela não', () => {
    render(<Tree />);
    const anchor = appendLink('/dashboard#s-gastos');
    const route = appendLink('/aprender');
    fireEvent.click(anchor);
    expect(bar().style.opacity).not.toBe('1');
    fireEvent.click(route);
    expect(isRunning()).toBe(true);
    anchor.remove();
    route.remove();
  });

  it('encerra sozinha em 12s e a próxima navegação liga de novo', () => {
    render(<Tree />);
    act(() => captured.api.startNavigation('/aprender'));
    act(() => {
      vi.advanceTimersByTime(12000 + 260);
    });
    expect(bar().style.opacity).toBe('0');
    act(() => captured.api.startNavigation('/aprender'));
    expect(isRunning()).toBe(true);
  });
});
