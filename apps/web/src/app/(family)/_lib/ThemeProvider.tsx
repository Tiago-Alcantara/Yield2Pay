'use client';

import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, isFamilyThemePath, isThemeId, type ThemeDef } from './themes';

interface ThemeContextValue {
  theme: ThemeDef;
  themes: readonly ThemeDef[];
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const listeners = new Set<() => void>();

function readTheme(): string {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Aplica o tema no <html>; o CSS (themes.css) faz o resto. */
function applyTheme(id: string) {
  document.documentElement.dataset.theme = id;
}

/**
 * Tema de aparência da família. Persistido em localStorage['y2p-tema'] e
 * aplicado em <html data-theme>. THEME_BOOT_SCRIPT (no layout raiz) aplica
 * antes do primeiro paint para evitar flash.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const id = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  const pathname = usePathname() || '/';
  const allowed = isFamilyThemePath(pathname);

  // useLayoutEffect tira o atributo antes do paint ao sair para /, /b2b ou /login.
  useLayoutEffect(() => {
    if (!allowed) {
      delete document.documentElement.dataset.theme;
      return;
    }
    applyTheme(id);
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [id, allowed]);

  const setTheme = useCallback((next: string) => {
    if (!isThemeId(next)) return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* armazenamento indisponível: vale só nesta sessão */
    }
    applyTheme(next);
    listeners.forEach((l) => l());
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: THEMES.find((t) => t.id === id) ?? THEMES[0], themes: THEMES, setTheme }),
    [id, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>');
  return ctx;
}
