/**
 * Módulo: GroupMenu
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: O menu de grupos abre, fecha e só persiste um id conhecido.
 * Sequência: abre pelo botão da conta; fecha no clique fora, no Esc e ao escolher; grava y2p-grupo; ignora valor inválido sem mostrá-lo.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/dashboard',
}));

import { resetFamilyStore, updateFamilyStore } from '../_lib/familyStore';
import { FamilyProvider } from '../_lib/FamilyProvider';
import { GroupMenu } from './GroupMenu';

const PAYLOAD = '"><img src=x onerror=alert(1)>';

function renderMenu(householdName?: string) {
  return render(
    <FamilyProvider>
      <div>
        <button type="button">fora</button>
        <GroupMenu name="Marina" initial="M" householdName={householdName} />
      </div>
    </FamilyProvider>,
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Trocar grupo de finanças' }));
}

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
  resetFamilyStore();
});

describe('menu de grupos', () => {
  it('abre e fecha ao clicar fora', () => {
    renderMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    openMenu();
    expect(screen.getByRole('menu', { name: 'Grupos de finanças' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trocar grupo de finanças' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('3 grupos')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'fora' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trocar grupo de finanças' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('fecha com Esc', () => {
    renderMenu();
    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('fecha ao escolher, persiste a escolha e avisa', () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Casa da praia/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(localStorage.getItem('y2p-grupo')).toBe('casa');
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando finanças de “Casa da praia”.');
    expect(screen.getByText('Casa da praia')).toBeInTheDocument();
  });

  it('reabre na escolha salva', () => {
    localStorage.setItem('y2p-grupo', 'eu');
    renderMenu();
    expect(screen.getByText('Pessoal')).toBeInTheDocument();
    openMenu();
    expect(screen.getByRole('menuitemradio', { name: /Pessoal/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('ignora valor inválido no localStorage e não o mostra', () => {
    localStorage.setItem('y2p-grupo', 'eu');
    renderMenu();
    expect(screen.getByText('Pessoal')).toBeInTheDocument();

    localStorage.setItem('y2p-grupo', PAYLOAD);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage'));
    });

    expect(screen.queryByText('Pessoal')).not.toBeInTheDocument();
    expect(screen.getByText('Família Souza')).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(PAYLOAD);
    expect(document.body.innerHTML).not.toContain('onerror');
    expect(document.querySelector('img')).toBeNull();
  });

  it('troca o exemplo pelo nome da família vindo da conta', () => {
    renderMenu('Família Alcantara');
    openMenu();
    expect(screen.getByRole('menuitemradio', { name: /Família Alcantara/ })).toBeInTheDocument();
    expect(screen.queryByText('Família Souza')).not.toBeInTheDocument();
    expect(screen.getByText('FA')).toBeInTheDocument();
  });

  it('leva a criar grupo e a ver a conta', () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Criar novo grupo' }));
    expect(push).toHaveBeenCalledWith('/dashboard?conta=1');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ver minha conta' }));
    expect(push).toHaveBeenCalledWith('/conta');
  });

  it('avisa em inglês com a mesma chave salva', () => {
    updateFamilyStore((prev) => ({ ...prev, lang: 'en' }));
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Switch finance group' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Casa da praia/ }));
    expect(localStorage.getItem('y2p-grupo')).toBe('casa');
    expect(screen.getByRole('status')).toHaveTextContent('Showing finances for “Casa da praia”.');
  });
});
