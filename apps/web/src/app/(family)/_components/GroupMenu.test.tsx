/**
 * Módulo: GroupMenu
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: O menu mostra só a casa real e se opera pelo teclado.
 * Sequência: abre com foco no primeiro item; setas navegam; Esc devolve o foco; Tab fecha; um y2p-grupo inválido não aparece.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/dashboard',
}));

import { resetFamilyStore } from '../_lib/familyStore';
import { FamilyProvider } from '../_lib/FamilyProvider';
import { GROUP_STORAGE_KEY } from '../_lib/groupStore';
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
  it('mostra só o grupo real, sem saldo, meta ou grupos de exemplo', () => {
    renderMenu('Família Alcantara');
    expect(screen.getByText('Família Alcantara')).toBeInTheDocument();
    expect(screen.queryByText('Família Souza')).not.toBeInTheDocument();
    expect(screen.queryByText('Casa da praia')).not.toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/membros/)).not.toBeInTheDocument();

    openMenu();
    expect(screen.getByRole('menu', { name: 'Grupos de finanças' })).toBeInTheDocument();
    expect(screen.getAllByText('Família Alcantara').length).toBeGreaterThan(0);
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 8.240')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('abre com foco no menu, navega com setas, fecha no Tab e devolve o foco no Esc', () => {
    renderMenu('Casa');
    const trigger = screen.getByRole('button', { name: 'Trocar grupo de finanças' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    openMenu();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('menuitem');
    expect(items[0]).toHaveFocus();

    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1], { key: 'ArrowUp' });
    expect(items[0]).toHaveFocus();

    fireEvent.keyDown(items[0], { key: 'Tab' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    openMenu();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('fecha ao clicar fora', () => {
    renderMenu('Casa');
    openMenu();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'fora' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('ignora y2p-grupo inválido já na abertura e não mostra o valor', () => {
    localStorage.setItem(GROUP_STORAGE_KEY, PAYLOAD);
    renderMenu('Casa');
    openMenu();
    expect(document.body.innerHTML).not.toContain(PAYLOAD);
    expect(document.body.innerHTML).not.toContain('onerror');
    expect(document.querySelector('img, script')).toBeNull();
    expect(screen.queryByText('Família Souza')).not.toBeInTheDocument();
    expect(screen.getAllByText('Casa').length).toBeGreaterThan(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('abre as configurações do grupo e a conta, sem toast', () => {
    renderMenu('Casa');
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Configurações do grupo' }));
    expect(push).toHaveBeenCalledWith('/dashboard?conta=1');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByText(/Mostrando finanças/)).not.toBeInTheDocument();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ver minha conta' }));
    expect(push).toHaveBeenCalledWith('/conta');
  });
});
