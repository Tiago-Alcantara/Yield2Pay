'use client';
import { useCallback, useSyncExternalStore } from 'react';

// SSR: assume desktop até hidratar (matchMedia não existe no servidor).
const getServerSnapshot = () => false;

/**
 * True quando a viewport está abaixo de `breakpoint` (default 768px).
 *
 * Usa useSyncExternalStore para manter o valor em sincronia com matchMedia sem
 * chamar setState dentro de um effect (evita render em cascata) e de forma
 * SSR-safe — o servidor sempre lê false e o cliente reconcilia na hidratação.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
