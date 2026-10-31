import { useSyncExternalStore } from 'react';
import type { AccountView } from '@yield2pay/shared';

/**
 * Conta da família vista pela doca. O painel publica aqui o que carrega da API
 * e a doca busca sozinha quando abre direto em outra tela (/aprender etc.).
 */
let current: AccountView | null = null;
const listeners = new Set<() => void>();

export function setAccountView(next: AccountView | null): void {
  current = next;
  listeners.forEach((l) => l());
}

export function getAccountView(): AccountView | null {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAccountView(): AccountView | null {
  return useSyncExternalStore(subscribe, getAccountView, () => null);
}
