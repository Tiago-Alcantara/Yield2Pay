/**
 * Módulo: ThemeProvider
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: O tema salvo só entra se for da lista, e some em /b2b e /login.
 * Sequência: aplica um id permitido; ignora valor inválido ou malicioso e cai no padrão sem injetar; não aplica em /b2b nem em /login; o provider recusa id fora da lista e tira o atributo ao desmontar.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function readWebFile(fromWebRoot: string): string {
  const direct = join(process.cwd(), fromWebRoot);
  const nested = join(process.cwd(), 'apps/web', fromWebRoot);
  return readFileSync(existsSync(direct) ? direct : nested, 'utf8');
}
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';
import { DEFAULT_THEME, THEME_BOOT_SCRIPT, THEME_STORAGE_KEY, THEMES, isThemeId } from './themes';

const PAYLOADS = [
  '"><img src=x onerror=alert(1)>',
  'escuro" onload="alert(1)',
  '</script><script>alert(1)</script>',
  'escuro;alert(1)',
  'javascript:alert(1)',
  '__proto__',
  'constructor',
  'escuro ',
  'ESCURO',
  'cloud-teal\n',
  '<svg/onload=alert(1)>',
  'not-a-theme',
];

function runThemeBootScript(pathname: string): void {
  window.history.pushState(null, '', pathname);
  document.documentElement.removeAttribute('data-theme');
  // O layout raiz injeta este texto num <script beforeInteractive>. Rodar o
  // mesmo texto é o que prova que o valor do localStorage não vira código.
  const run = new Function(THEME_BOOT_SCRIPT);
  run();
}

function themeAttr(): string | null {
  return document.documentElement.getAttribute('data-theme');
}

function Setter({ id }: { id: string }) {
  const { setTheme, theme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme(id)}>
      aplicar {theme.id}
    </button>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  window.history.pushState(null, '', '/');
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  window.history.pushState(null, '', '/');
});

describe('script anti-flash', () => {
  it('está no layout raiz, antes da hidratação', () => {
    const layout = readWebFile('src/app/layout.tsx');
    expect(layout).toContain('THEME_BOOT_SCRIPT');
    expect(layout).toContain('strategy="beforeInteractive"');
    expect(THEME_BOOT_SCRIPT).not.toContain('innerHTML');
    expect(THEME_BOOT_SCRIPT).not.toContain('document.write');
    expect(THEME_BOOT_SCRIPT).not.toContain('eval(');
  });

  it('aplica só um tema da lista', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'petroleo');
    runThemeBootScript('/dashboard');
    expect(themeAttr()).toBe('petroleo');
    expect(isThemeId(themeAttr())).toBe(true);
  });

  it('ignora valor inválido ou malicioso e cai no tema padrão, sem injetar', () => {
    for (const payload of PAYLOADS) {
      localStorage.setItem(THEME_STORAGE_KEY, payload);
      runThemeBootScript('/aprender');
      const theme = themeAttr();
      expect(theme === null || theme === DEFAULT_THEME).toBe(true);
      expect(theme).not.toBe(payload);
      expect(document.documentElement.outerHTML).not.toContain(payload);
      expect(document.body.innerHTML).not.toContain(payload);
      expect(document.querySelector('img, iframe, object, embed, svg')).toBeNull();
      expect(document.documentElement.outerHTML).not.toMatch(/\son\w+\s*=/i);
    }
  });

  it('não aplica o tema em /b2b nem em /login', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'petroleo');
    for (const pathname of ['/b2b', '/b2b/', '/b2b/painel', '/login', '/login/', '/login/google']) {
      runThemeBootScript(pathname);
      expect(themeAttr()).toBeNull();
    }
  });

  it('continua valendo nas telas da família e não trata prefixo parecido como bloqueio', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'oled');
    for (const pathname of ['/', '/conta', '/configuracoes', '/conceitos', '/b2bextra', '/login-ajuda']) {
      runThemeBootScript(pathname);
      expect(themeAttr()).toBe('oled');
    }
  });
});

describe('ThemeProvider', () => {
  it('grava e aplica só um id da lista', () => {
    render(
      <ThemeProvider>
        <Setter id="floresta" />
      </ThemeProvider>,
    );
    expect(themeAttr()).toBe(DEFAULT_THEME);
    act(() => {
      screen.getByRole('button', { name: /aplicar/ }).click();
    });
    expect(themeAttr()).toBe('floresta');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('floresta');
    expect(THEMES.some((theme) => theme.id === 'floresta')).toBe(true);
  });

  it('ignora valor inválido ou malicioso do localStorage e não deixa injetar', () => {
    for (const payload of PAYLOADS) {
      localStorage.setItem(THEME_STORAGE_KEY, payload);
      const view = render(
        <ThemeProvider>
          <Setter id={payload} />
        </ThemeProvider>,
      );
      expect(themeAttr()).toBe(DEFAULT_THEME);
      expect(document.documentElement.outerHTML).not.toContain(payload);
      expect(document.querySelector('img, iframe, object, embed')).toBeNull();
      act(() => {
        screen.getByRole('button', { name: /aplicar/ }).click();
      });
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(payload);
      expect(themeAttr()).toBe(DEFAULT_THEME);
      expect(screen.getByRole('button', { name: /aplicar/ })).toHaveTextContent(DEFAULT_THEME);
      view.unmount();
      document.documentElement.removeAttribute('data-theme');
    }
  });

  it('tira o tema ao desmontar, então /b2b e /login não herdam o atributo', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'bordo');
    const view = render(
      <ThemeProvider>
        <span>família</span>
      </ThemeProvider>,
    );
    expect(themeAttr()).toBe('bordo');
    view.unmount();
    expect(themeAttr()).toBeNull();
  });
});
