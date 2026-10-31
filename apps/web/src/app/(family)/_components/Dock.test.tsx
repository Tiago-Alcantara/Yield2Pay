/**
 * Módulo: Dock
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: A doca marca o item da rota, manda as ações rápidas ao painel e some fora da família.
 * Sequência: mostra a doca só nas telas logadas; marca Aprender em /aprender e /conceitos, nenhum em /configuracoes e Painel no resto; navega com ?acao=importar|novo|convidar; mantém no DOM as classes que o CSS esconde no tablet e no celular.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pathRef = vi.hoisted(() => ({ current: '/dashboard' }));
const push = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: () => pathRef.current,
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock('@/providers/PrivyProviderWrapper', () => ({
  isPrivyConfigured: false,
}));

import { setAccountView } from '../_lib/accountStore';
import { resetFamilyStore, updateFamilyStore } from '../_lib/familyStore';
import { writeLiberdade } from '../_lib/liberdadePref';
import { Dock, activeDockItem, showsDock } from './Dock';
import { FamilyProvider } from '../_lib/FamilyProvider';

const familyCssPath = join(process.cwd(), 'src/app/(family)/family.css');
const familyCss = readFileSync(
  existsSync(familyCssPath) ? familyCssPath : join(process.cwd(), 'apps/web/src/app/(family)/family.css'),
  'utf8',
);

function renderDock(pathname: string) {
  pathRef.current = pathname;
  return render(
    <FamilyProvider>
      <Dock />
    </FamilyProvider>,
  );
}

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
  resetFamilyStore();
  document.body.classList.remove('fam-has-dock');
  setAccountView({
    displayName: 'Marina',
    fullName: 'Marina Alves',
    email: 'marina@email.com',
    initials: 'MA',
    accountType: 'family',
    household: { id: 'h1', name: 'Casa', role: 'owner', onboardingCompleted: true },
  });
});

describe('doca', () => {
  it('aparece só nas telas logadas da família', () => {
    expect(showsDock('/dashboard')).toBe(true);
    expect(showsDock('/dashboard/abc')).toBe(true);
    expect(showsDock('/aprender')).toBe(true);
    expect(showsDock('/configuracoes')).toBe(true);
    expect(showsDock('/conta')).toBe(true);
    expect(showsDock('/')).toBe(false);
    expect(showsDock('/onboarding')).toBe(false);
    expect(showsDock('/b2b')).toBe(false);
    expect(showsDock('/b2b/painel')).toBe(false);
    expect(showsDock('/login')).toBe(false);
    expect(showsDock(null)).toBe(false);
  });

  it('marca o item ativo pela rota', () => {
    expect(activeDockItem('/aprender')).toBe('aprender');
    expect(activeDockItem('/conceitos')).toBe('aprender');
    expect(activeDockItem('/configuracoes')).toBeNull();
    expect(activeDockItem('/dashboard')).toBe('painel');
    expect(activeDockItem('/conta')).toBe('painel');
  });

  it('marca Aprender em /aprender e /conceitos e Painel no resto', () => {
    renderDock('/aprender');
    expect(screen.getByRole('link', { name: 'Aprender' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current');

    renderDock('/conceitos/carteira');
    expect(screen.getAllByRole('link', { name: 'Aprender' }).at(-1)).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { name: 'Painel' }).at(-1)).not.toHaveAttribute('aria-current');

    renderDock('/dashboard');
    expect(screen.getAllByRole('link', { name: 'Painel' }).at(-1)).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { name: 'Gastos' }).at(-1)).not.toHaveAttribute('aria-current');
    expect(screen.getAllByRole('link', { name: 'Aprender' }).at(-1)).not.toHaveAttribute('aria-current');

    renderDock('/conta');
    expect(screen.getAllByRole('link', { name: 'Painel' }).at(-1)).toHaveAttribute('aria-current', 'page');
  });

  it('não marca item nenhum em /configuracoes', () => {
    renderDock('/configuracoes');
    expect(screen.queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Menu' })).toBeInTheDocument();
  });

  it('não mostra a doca fora da família e tira a reserva do rodapé', () => {
    const view = renderDock('/dashboard');
    expect(document.body).toHaveClass('fam-has-dock');
    view.unmount();
    expect(document.body).not.toHaveClass('fam-has-dock');

    renderDock('/b2b');
    expect(screen.queryByRole('navigation', { name: 'Menu' })).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('fam-has-dock');

    renderDock('/login');
    expect(screen.queryByRole('navigation', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('manda importar, novo gasto e convidar para o painel', () => {
    renderDock('/aprender');
    fireEvent.click(screen.getByRole('button', { name: 'Importar extrato' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo gasto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Convidar família' }));
    expect(push).toHaveBeenNthCalledWith(1, '/dashboard?acao=importar');
    expect(push).toHaveBeenNthCalledWith(2, '/dashboard?acao=novo');
    expect(push).toHaveBeenNthCalledWith(3, '/dashboard?acao=convidar');
    expect(screen.getByRole('link', { name: 'Definir meta do mês' })).toHaveAttribute('href', '/dashboard#s-liberdade');
    expect(screen.getByRole('link', { name: 'Gastos' })).toHaveAttribute('href', '/dashboard#s-gastos');
    expect(screen.getByRole('link', { name: 'Liberdade' })).toHaveAttribute('href', '/dashboard#s-liberdade');
    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Aprender' })).toHaveAttribute('href', '/aprender');
  });

  it('usa os mesmos destinos em inglês', () => {
    updateFamilyStore((prev) => ({ ...prev, lang: 'en' }));
    renderDock('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Import statement' }));
    fireEvent.click(screen.getByRole('button', { name: 'New expense' }));
    fireEvent.click(screen.getByRole('button', { name: 'Invite family' }));
    expect(push).toHaveBeenNthCalledWith(1, '/dashboard?acao=importar');
    expect(push).toHaveBeenNthCalledWith(2, '/dashboard?acao=novo');
    expect(push).toHaveBeenNthCalledWith(3, '/dashboard?acao=convidar');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Learn' })).not.toHaveAttribute('aria-current');
  });

  it('mostra o nome e a família da conta', () => {
    renderDock('/dashboard');
    const account = document.querySelector('#y2p-dock .dk-us');
    expect(account).toHaveTextContent('Marina');
    expect(account).toHaveTextContent('Casa');
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('esconde Liberdade da navegação quando a preferência está desligada', () => {
    writeLiberdade(false);
    renderDock('/dashboard');
    expect(screen.queryByRole('link', { name: 'Liberdade' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Definir meta do mês' })).toBeInTheDocument();
  });

  it('deixa no DOM as classes que o CSS esconde no tablet e no celular', () => {
    expect(familyCss).toMatch(/@media \(max-width: 1100px\) \{[^}]*#y2p-dock \.dk-us \{[^}]*display:\s*none/);
    expect(familyCss).toMatch(
      /@media \(max-width: 640px\) \{[\s\S]*?#y2p-dock \.dk-qb,\s*#y2p-dock \.dk-sep\.dk-sep-q \{\s*display:\s*none/,
    );
    expect(familyCss).toMatch(/@media \(max-width: 640px\) \{[\s\S]*?#y2p-dock \.dk-cta \{[^}]*font-size:\s*0/);

    renderDock('/dashboard');
    expect(document.querySelector('#y2p-dock .dk-us')).toHaveTextContent('Marina');
    expect(screen.getByRole('button', { name: 'Trocar grupo de finanças' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar extrato' })).toHaveClass('dk-qb');
    expect(screen.getByRole('link', { name: 'Definir meta do mês' })).toHaveClass('dk-qb');
    expect(screen.getByRole('button', { name: 'Convidar família' })).toHaveClass('dk-qb');
    expect(document.querySelector('#y2p-dock .dk-sep-q')).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: 'Novo gasto' });
    expect(cta).toHaveClass('dk-cta');
    expect(cta).toHaveAttribute('aria-label', 'Novo gasto');
    expect(cta).toHaveTextContent('Novo gasto');
  });
});
