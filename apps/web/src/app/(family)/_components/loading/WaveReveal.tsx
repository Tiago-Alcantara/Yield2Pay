'use client';

/* Revelação em onda: quando o conteúdo real monta, cada [data-reveal] entra com
   fade + 4px, com atraso proporcional à posição vertical na tela (0 → 600ms).
   Não muda layout: o wrapper é display:contents. Não reanima em re-render:
   só quando o componente monta (ou quando runKey muda). */

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function WaveReveal({ children, runKey, spread = 600 }: { children: ReactNode; runKey?: unknown; spread?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const vh = window.innerHeight || 1;
    root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
      const t = Math.max(0, Math.min(1, el.getBoundingClientRect().top / vh));
      el.style.setProperty('--y2p-d', Math.round(t * spread) + 'ms');
    });
    root.classList.add('y2p-ld-wave');
    const id = window.setTimeout(() => root.classList.remove('y2p-ld-wave'), spread + 600);
    return () => window.clearTimeout(id);
  }, [runKey, spread]);

  return (
    <div ref={ref} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
