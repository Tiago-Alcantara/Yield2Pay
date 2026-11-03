'use client';

/* Splash ao entrar no painel: uma vez por sessão do navegador (sessionStorage).
   - Fica no mínimo minMs (evita piscar) e no máximo maxMs (não segura o usuário:
     se a API demorar, sai e o skeleton continua por baixo).
   - Pode ser montado em mais de um lugar (FamilySessionGate e PainelGastos):
     o relógio é compartilhado, então a troca entre os dois é contínua.
   - O servidor não conhece o sessionStorage. Por isso nada sai no HTML e a fase
     é decidida no layout effect, antes da pintura: sem isso, todo reload de uma
     sessão que já viu o splash piscaria o splash até a hidratação.
   - Se o relógio já passou de maxMs (Privy lento, onboarding no meio do caminho),
     montar de novo não reabre um splash vencido só para fazê-lo sumir. */

import { useEffect, useLayoutEffect, useState } from 'react';

const KEY = 'y2p-splash-visto';
let firstShownAt: number | null = null;

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function alreadySeen() {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function markAsSeen() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {}
}

/** O FamilySessionGate chama ao mandar para /login: o splash volta no próximo login da mesma aba. */
export function resetAppSplash() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  firstShownAt = null;
}

/** markSeen=false: este splash não marca a sessão como "vista" ao sair (use no
 *  FamilySessionGate, que pode sair por causa de um redirect para /login). */
export function AppSplash({ loading, minMs = 900, maxMs = 2500, markSeen = true }: { loading: boolean; minMs?: number; maxMs?: number; markSeen?: boolean }) {
  const [phase, setPhase] = useState<'pending' | 'in' | 'out' | 'gone'>('pending');

  useIsoLayoutEffect(() => {
    if (alreadySeen()) {
      setPhase('gone');
      return;
    }
    if (firstShownAt != null && Date.now() - firstShownAt >= maxMs) {
      if (markSeen) markAsSeen();
      setPhase('gone');
      return;
    }
    if (firstShownAt == null) firstShownAt = Date.now();
    setPhase('in');
  }, []);

  useEffect(() => {
    if (phase !== 'in') return;
    const since = Date.now() - (firstShownAt ?? Date.now());
    const wait = loading ? Math.max(0, maxMs - since) : Math.max(0, minMs - since);
    const id = window.setTimeout(() => setPhase('out'), wait);
    return () => window.clearTimeout(id);
  }, [loading, phase, minMs, maxMs]);

  useEffect(() => {
    if (phase !== 'out') return;
    if (markSeen) markAsSeen();
    const id = window.setTimeout(() => setPhase('gone'), 500);
    return () => window.clearTimeout(id);
  }, [phase, markSeen]);

  if (phase === 'pending' || phase === 'gone') return null;

  return (
    <div className="y2p-ld-splash" data-phase={phase} role="status" aria-live="polite">
      <span className="y2p-ld-splash__mark" aria-hidden="true" />
      <span className="y2p-ld-splash__word">Yield2Pay</span>
      <span className="y2p-ld-splash__track" aria-hidden="true"><i /></span>
      <span className="y2p-ld-splash__kicker">Preparando seu painel</span>
    </div>
  );
}
