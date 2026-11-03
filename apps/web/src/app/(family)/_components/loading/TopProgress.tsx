'use client';

/* Barra de 2px no topo. Dois usos:
   1. Navegação: detecta sozinho cliques em <a href> internos; para router.push
      chame startNavigation(href) antes. Termina quando o pathname muda, então
      ignora o href que fica no mesmo pathname (só query ou hash).
   2. Dados: start() no início do fetch, done() no fim (contador: várias
      requisições ao mesmo tempo mantêm a barra até a última terminar).
   Nunca fica presa: encerra sozinha após 12s. Sem dependências novas. */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type TopProgressApi = { start: () => void; done: () => void; startNavigation: (href: string) => void };

const noop = () => {};
const Ctx = createContext<TopProgressApi>({ start: noop, done: noop, startNavigation: noop });

export const useTopProgress = () => useContext(Ctx);

const EASE = 'cubic-bezier(.2,.65,.2,1)';

export function TopProgressProvider({ children }: { children: ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  const active = useRef(0);
  const navPending = useRef(false);
  const timers = useRef<number[]>([]);
  const pathname = usePathname();

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const finish = useCallback(() => {
    const el = bar.current;
    clearTimers();
    if (!el || el.style.opacity !== '1') return;
    el.style.transition = 'width .25s ' + EASE;
    el.style.width = '100%';
    timers.current.push(
      window.setTimeout(() => {
        el.style.transition = 'opacity .3s';
        el.style.opacity = '0';
      }, 260),
    );
  }, []);

  const start = useCallback(() => {
    active.current += 1;
    const el = bar.current;
    if (!el || active.current > 1) return;
    clearTimers();
    el.style.transition = 'none';
    el.style.width = '0';
    el.style.opacity = '1';
    void el.offsetWidth;
    el.style.transition = 'width 1.8s ' + EASE;
    el.style.width = '78%';
    timers.current.push(
      window.setTimeout(() => {
        active.current = 0;
        navPending.current = false;
        finish();
      }, 12000),
    );
  }, [finish]);

  const done = useCallback(() => {
    active.current = Math.max(0, active.current - 1);
    if (active.current === 0) finish();
  }, [finish]);

  const startNavigation = useCallback((href: string) => {
    if (navPending.current) return;
    if (new URL(href, window.location.href).pathname === window.location.pathname) return;
    navPending.current = true;
    start();
  }, [start]);

  useEffect(() => {
    if (!navPending.current) return;
    navPending.current = false;
    done();
  }, [pathname, done]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      startNavigation(url.href);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [startNavigation]);

  useEffect(() => () => clearTimers(), []);

  const api = useMemo(() => ({ start, done, startNavigation }), [start, done, startNavigation]);

  return (
    <Ctx.Provider value={api}>
      <div ref={bar} className="y2p-ld-top" aria-hidden="true" />
      {children}
    </Ctx.Provider>
  );
}
