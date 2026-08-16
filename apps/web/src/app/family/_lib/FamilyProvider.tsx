'use client';

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { FAM, type FamilyDict, type FamilyLang } from './familyI18n';
import type { FamilySub } from './familyMath';
import {
  DEFAULT_FAMILY_STATE,
  getFamilyServerSnapshot,
  getFamilySnapshot,
  subscribeFamilyStore,
  updateFamilyStore,
  type FamilyState,
} from './familyStore';

export type { FamilyState, FamilyDevice, FamilyProfile } from './familyStore';
export { SEED_DEPOSIT, DEFAULT_FAMILY_STATE } from './familyStore';

interface FamilyContextValue {
  state: FamilyState;
  /** Merge raso no estado. */
  patch: (next: Partial<FamilyState>) => void;
  lang: FamilyLang;
  setLang: (lang: FamilyLang) => void;
  t: FamilyDict;
  /** Soma ao saldo depositado e marca o onboarding como concluído. */
  addDeposit: (amount: number) => void;
  /** Subtrai do saldo depositado (nunca abaixo de zero). */
  withdraw: (amount: number) => void;
  addSub: (sub: Omit<FamilySub, 'id'>) => void;
  updateSub: (id: string, next: Partial<FamilySub>) => void;
  removeSub: (id: string) => void;
  /** Move a assinatura na ordem de prioridade. */
  moveSub: (id: string, direction: -1 | 1) => void;
  /** Volta ao estado inicial, preservando o idioma (usado pelo "Sair"). */
  reset: () => void;
}

const FamilyContext = createContext<FamilyContextValue | undefined>(undefined);

/**
 * Provedor do subtree /family.
 *
 * O estado mora num store externo (familyStore) e chega aqui por
 * useSyncExternalStore — o localStorage entra na hidratação sem efeito nenhum.
 */
export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(
    subscribeFamilyStore,
    getFamilySnapshot,
    getFamilyServerSnapshot,
  );

  const patch = useCallback((next: Partial<FamilyState>) => {
    updateFamilyStore((prev) => ({ ...prev, ...next }));
  }, []);

  const actions = useMemo(
    () => ({
      patch,
      setLang: (lang: FamilyLang) => patch({ lang }),
      addDeposit: (amount: number) =>
        updateFamilyStore((prev) => ({
          ...prev,
          deposit: prev.deposit + Math.max(0, amount),
          onboarded: true,
        })),
      withdraw: (amount: number) =>
        updateFamilyStore((prev) => ({
          ...prev,
          deposit: Math.max(0, prev.deposit - Math.max(0, amount)),
        })),
      addSub: (sub: Omit<FamilySub, 'id'>) =>
        updateFamilyStore((prev) => ({
          ...prev,
          subs: [...prev.subs, { ...sub, id: `c-${Date.now()}-${prev.subs.length}` }],
        })),
      updateSub: (id: string, next: Partial<FamilySub>) =>
        updateFamilyStore((prev) => ({
          ...prev,
          subs: prev.subs.map((s) => (s.id === id ? { ...s, ...next } : s)),
        })),
      removeSub: (id: string) =>
        updateFamilyStore((prev) => ({ ...prev, subs: prev.subs.filter((s) => s.id !== id) })),
      moveSub: (id: string, direction: -1 | 1) =>
        updateFamilyStore((prev) => {
          const i = prev.subs.findIndex((s) => s.id === id);
          const j = i + direction;
          if (i < 0 || j < 0 || j >= prev.subs.length) return prev;
          const subs = [...prev.subs];
          [subs[i], subs[j]] = [subs[j], subs[i]];
          return { ...prev, subs };
        }),
      reset: () =>
        updateFamilyStore((prev) => ({ ...DEFAULT_FAMILY_STATE, lang: prev.lang })),
    }),
    [patch],
  );

  const value = useMemo<FamilyContextValue>(
    () => ({ state, lang: state.lang, t: FAM[state.lang], ...actions }),
    [state, actions],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

/** Acesso ao estado de família. Só funciona dentro de /family (o layout provê). */
export function useFamily(): FamilyContextValue {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily precisa estar dentro de <FamilyProvider>');
  return ctx;
}
