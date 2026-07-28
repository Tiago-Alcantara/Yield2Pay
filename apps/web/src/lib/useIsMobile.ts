'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { useBreakpoint } from '@/lib/useBreakpoint';

const getServerSnapshot = () => false;

/**
 * True quando a viewport está abaixo de `breakpoint` (default 768px).
 *
 * Compat: mantém a API booleana usada pelas telas. No default (768) delega ao
 * useBreakpoint (tier != desktop). Com breakpoint custom, usa matchMedia direto.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const tier = useBreakpoint();

  const query = `(max-width: ${breakpoint - 1}px)`;
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const custom = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return breakpoint === 768 ? tier !== 'desktop' : custom;
}
