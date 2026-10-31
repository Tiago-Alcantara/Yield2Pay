/**
 * Módulo: AppearanceSection
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: A grade de aparência aplica o tema na hora, em português e em inglês.
 * Sequência: separa 11 escuros e 4 claros; aplica o tema no html e no localStorage; mostra o aviso; repete os rótulos em inglês.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/configuracoes',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { AppearanceSection } from './AppearanceSection';
import { FamilyProvider } from '../_lib/FamilyProvider';
import { resetFamilyStore, updateFamilyStore } from '../_lib/familyStore';
import { ThemeProvider } from '../_lib/ThemeProvider';
import { THEME_STORAGE_KEY, THEMES } from '../_lib/themes';

const PAYLOAD = '"><img src=x onerror=alert(1)>';

function renderAppearance() {
  return render(
    <ThemeProvider>
      <FamilyProvider>
        <AppearanceSection />
      </FamilyProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetFamilyStore();
  document.documentElement.removeAttribute('data-theme');
});

describe('aparência', () => {
  it('separa a grade em Escuros 11 e Claros 4', () => {
    expect(THEMES.filter((theme) => theme.dark)).toHaveLength(11);
    expect(THEMES.filter((theme) => !theme.dark)).toHaveLength(4);

    renderAppearance();
    expect(screen.getByText('Escuros · 11')).toBeInTheDocument();
    expect(screen.getByText('Claros · 4')).toBeInTheDocument();
    expect(screen.getByText('O tema fica salvo neste aparelho.')).toBeInTheDocument();

    const dark = screen.getByRole('radiogroup', { name: 'Temas escuros' });
    const light = screen.getByRole('radiogroup', { name: 'Temas claros' });
    expect(within(dark).getAllByRole('radio')).toHaveLength(11);
    expect(within(light).getAllByRole('radio')).toHaveLength(4);
    expect(within(dark).queryByRole('radio', { name: /Cloud Dancer/ })).not.toBeInTheDocument();
    expect(within(light).queryByRole('radio', { name: /OLED/ })).not.toBeInTheDocument();
    expect(within(dark).getByRole('radio', { name: /Escuro/ })).toHaveAttribute('aria-checked', 'true');

    for (const theme of THEMES.filter((item) => item.dark)) {
      expect(within(dark).getByRole('radio', { name: new RegExp(theme.name) })).toBeInTheDocument();
    }
    for (const theme of THEMES.filter((item) => !item.dark)) {
      expect(within(light).getByRole('radio', { name: new RegExp(theme.name) })).toBeInTheDocument();
    }
  });

  it('aplica o tema no html, grava no aparelho e avisa', () => {
    renderAppearance();
    fireEvent.click(screen.getByRole('radio', { name: /Cloud Dancer/ }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'cloud-teal');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('cloud-teal');
    expect(screen.getByRole('status')).toHaveTextContent('Tema “Cloud Dancer” aplicado.');
    expect(screen.getByRole('radio', { name: /Cloud Dancer/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Escuro/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('ignora um tema malicioso já salvo e mantém o padrão', () => {
    localStorage.setItem(THEME_STORAGE_KEY, PAYLOAD);
    renderAppearance();
    expect(document.documentElement).toHaveAttribute('data-theme', 'escuro');
    expect(screen.getByRole('radio', { name: /Escuro/ })).toHaveAttribute('aria-checked', 'true');
    expect(document.body.innerHTML).not.toContain(PAYLOAD);
    expect(document.body.innerHTML).not.toContain('onerror');
    expect(document.querySelector('img')).toBeNull();
  });

  it('mostra a grade e o aviso em inglês', () => {
    updateFamilyStore((prev) => ({ ...prev, lang: 'en' }));
    renderAppearance();

    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Dark · 11')).toBeInTheDocument();
    expect(screen.getByText('Light · 4')).toBeInTheDocument();
    expect(screen.getByText('The theme is saved on this device.')).toBeInTheDocument();
    expect(within(screen.getByRole('radiogroup', { name: 'Dark themes' })).getAllByRole('radio')).toHaveLength(11);
    expect(within(screen.getByRole('radiogroup', { name: 'Light themes' })).getAllByRole('radio')).toHaveLength(4);

    fireEvent.click(screen.getByRole('radio', { name: /Gelo/ }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'gelo-marinho');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('gelo-marinho');
    expect(screen.getByRole('status')).toHaveTextContent('Theme “Gelo” applied.');
  });
});
