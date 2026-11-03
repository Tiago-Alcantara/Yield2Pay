/**
 * Módulo: TopProgress
 * Criado em: 2026-11-03
 * Última atualização: 2026-11-03
 * Intuito: A barra acompanha fetch e troca de rota, sem ficar presa quando o pathname não muda.
 * Sequência: fetch liga e desliga; duas cargas esperam a última; push para outro pathname liga e a troca desliga; mesmo pathname não liga; clique em link interno liga; âncora na mesma tela não liga; encerra sozinha em 12s e libera a próxima navegação.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopProgressProvider, useTopProgress } from './TopProgress';

const nav = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

let api: ReturnType<typeof useTopProgress>;

function Capture() {
  api = useTopProgress();
  return <a href="/aprender">aprender</a>;
}

function Tree() {
  return (
    <TopProgressProvider>
      <Capture />
      <a href="/dashboard#s-gastos">gastos</a>
    </TopProgressProvider>
  );
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
    act(() => api.start());
    expect(isRunning()).toBe(true);
    act(() => api.done());
    expect(bar().style.width).toBe('100%');
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(bar().style.opacity).toBe('0');
  });

  it('com duas cargas, espera a última terminar', () => {
    render(<Tree />);
    act(() => {
      api.start();
      api.start();
      api.done();
    });
    expect(isRunning()).toBe(true);
    act(() => api.done());
    expect(bar().style.width).toBe('100%');
  });

  it('router.push para outro pathname liga, e a troca de rota desliga', () => {
    const { rerender } = render(<Tree />);
    act(() => api.startNavigation('/aprender'));
    expect(isRunning()).toBe(true);
    nav.pathname = '/aprender';
    rerender(<Tree />);
    expect(bar().style.width).toBe('100%');
  });

  it('atalho no mesmo pathname não liga: nada desligaria a barra antes dos 12s', () => {
    render(<Tree />);
    act(() => api.startNavigation('/dashboard?acao=importar'));
    expect(bar().style.opacity).not.toBe('1');
  });

  it('clique em link interno liga; âncora na mesma tela não', () => {
    const { getByText } = render(<Tree />);
    getByText('gastos').addEventListener('click', (event) => event.preventDefault());
    getByText('aprender').addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(getByText('gastos'));
    expect(bar().style.opacity).not.toBe('1');
    fireEvent.click(getByText('aprender'));
    expect(isRunning()).toBe(true);
  });

  it('encerra sozinha em 12s e a próxima navegação liga de novo', () => {
    render(<Tree />);
    act(() => api.startNavigation('/aprender'));
    act(() => {
      vi.advanceTimersByTime(12000 + 260);
    });
    expect(bar().style.opacity).toBe('0');
    act(() => api.startNavigation('/aprender'));
    expect(isRunning()).toBe(true);
  });
});
