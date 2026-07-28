'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { BP, type Breakpoint } from '@/app/tokens/breakpoints';

const MOBILE_Q = `(max-width: ${BP.mobile - 1}px)`;
const TABLET_Q = `(max-width: ${BP.tablet - 1}px)`;

// SSR: assume desktop até hidratar (matchMedia não existe no servidor).
const getServerSnapshot = (): Breakpoint => 'desktop';

/**
 * Tier responsivo atual: 'mobile' (<480), 'tablet' (<768), 'desktop' (>=768).
 *
 * Mesma mecânica SSR-safe do useIsMobile (useSyncExternalStore + matchMedia),
 * generalizada para três tiers. Prefira CSS/@media para estilo; use este hook
 * só quando precisar renderizar/omitir elementos em JS.
 */
export function useBreakpoint(): Breakpoint {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mqls = [window.matchMedia(MOBILE_Q), window.matchMedia(TABLET_Q)];
    mqls.forEach((m) => m.addEventListener('change', onStoreChange));
    return () => mqls.forEach((m) => m.removeEventListener('change', onStoreChange));
  }, []);

  const getSnapshot = useCallback((): Breakpoint => {
    if (window.matchMedia(MOBILE_Q).matches) return 'mobile';
    if (window.matchMedia(TABLET_Q).matches) return 'tablet';
    return 'desktop';
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
