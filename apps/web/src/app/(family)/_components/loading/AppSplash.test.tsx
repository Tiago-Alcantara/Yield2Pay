/**
 * Módulo: AppSplash
 * Criado em: 2026-11-03
 * Última atualização: 2026-11-03
 * Intuito: O splash aparece uma vez por sessão, com tempo mínimo e máximo, e não reabre vencido.
 * Sequência: nada no HTML do servidor; sai no mínimo de 900ms; carga lenta sai em 2500ms; marca a sessão ao sair; sessão vista não mostra; markSeen=false não marca; relógio compartilhado entre gate e painel; relógio vencido não reabre; reset volta a mostrar.
 */
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSplash, resetAppSplash } from './AppSplash';

const KEY = 'y2p-splash-visto';
const splash = () => document.querySelector('.y2p-ld-splash');

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('AppSplash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAppSplash();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAppSplash();
  });

  it('não sai no HTML do servidor, que não conhece o sessionStorage', () => {
    expect(renderToString(<AppSplash loading />)).toBe('');
  });

  it('com os dados prontos, sai em 900ms, some em .5s e marca a sessão', () => {
    render(<AppSplash loading={false} />);
    expect(screen.getByText('Preparando seu painel')).toBeInTheDocument();
    expect(splash()).toHaveAttribute('data-phase', 'in');
    advance(899);
    expect(splash()).toHaveAttribute('data-phase', 'in');
    expect(sessionStorage.getItem(KEY)).toBeNull();
    advance(1);
    expect(splash()).toHaveAttribute('data-phase', 'out');
    expect(sessionStorage.getItem(KEY)).toBe('1');
    advance(500);
    expect(splash()).toBeNull();
  });

  it('com a carga lenta, sai em 2500ms mesmo sem os dados', () => {
    render(<AppSplash loading />);
    advance(2499);
    expect(splash()).toHaveAttribute('data-phase', 'in');
    advance(1);
    expect(splash()).toHaveAttribute('data-phase', 'out');
  });

  it('não aparece de novo na mesma sessão', () => {
    sessionStorage.setItem(KEY, '1');
    render(<AppSplash loading />);
    expect(splash()).toBeNull();
  });

  it('com markSeen=false, sair não marca a sessão', () => {
    render(<AppSplash loading markSeen={false} />);
    advance(2500);
    expect(splash()).toHaveAttribute('data-phase', 'out');
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('a passagem do gate para o painel continua o mesmo relógio', () => {
    const gate = render(<AppSplash loading markSeen={false} />);
    advance(600);
    gate.unmount();
    render(<AppSplash loading={false} />);
    expect(splash()).toHaveAttribute('data-phase', 'in');
    advance(299);
    expect(splash()).toHaveAttribute('data-phase', 'in');
    advance(1);
    expect(splash()).toHaveAttribute('data-phase', 'out');
  });

  it('com o relógio vencido, montar de novo não reabre o splash e marca a sessão', () => {
    const gate = render(<AppSplash loading markSeen={false} />);
    advance(2500 + 500);
    gate.unmount();
    expect(sessionStorage.getItem(KEY)).toBeNull();
    render(<AppSplash loading />);
    expect(splash()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBe('1');
  });

  it('resetAppSplash faz o splash voltar', () => {
    const first = render(<AppSplash loading={false} />);
    advance(900 + 500);
    first.unmount();
    expect(sessionStorage.getItem(KEY)).toBe('1');
    resetAppSplash();
    render(<AppSplash loading={false} />);
    expect(splash()).toHaveAttribute('data-phase', 'in');
  });
});
