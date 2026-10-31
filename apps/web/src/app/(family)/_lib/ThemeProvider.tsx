'use client';

import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, isThemeId, type ThemeDef } from './themes';

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
 * aplicado em <html data-theme>. O script inline em ThemeScript aplica antes
 * do primeiro paint para evitar flash.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const id = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);

  // Mantém o atributo em dia (inclusive após navegação cliente).
  React.useEffect(() => {
    applyTheme(id);
    // Fora da vertical de famílias (ex.: /b2b) o tema não se aplica.
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [id]);

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

/** Script inline: aplica o tema salvo antes do primeiro paint. */
export function ThemeScript() {
  const code = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t)document.documentElement.dataset.theme=t}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
