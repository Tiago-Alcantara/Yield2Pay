/**
 * family.test.tsx
 * Testes de comportamento das telas de família: a calculadora da landing e o
 * painel. Sem rede — o estado vem do store local (familyStore).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/family',
}));

import { FamilyProvider } from './_lib/FamilyProvider';
import { resetFamilyStore, updateFamilyStore } from './_lib/familyStore';
import FamilyLandingPage from './page';
import FamilyDashboardPage from './dashboard/page';

function renderInFamily(ui: React.ReactElement) {
  return render(<FamilyProvider>{ui}</FamilyProvider>);
}

beforeEach(() => {
  push.mockClear();
  resetFamilyStore();
});

describe('landing /family', () => {
  it('mostra a proposta em português por padrão', () => {
    renderInFamily(<FamilyLandingPage />);
    expect(
      screen.getByText('O rendimento do seu próprio dinheiro paga suas assinaturas.'),
    ).toBeInTheDocument();
  });

  it('troca a página inteira para inglês pelo seletor de idioma', () => {
    renderInFamily(<FamilyLandingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(
      screen.getByText('The yield on your own money pays your subscriptions.'),
    ).toBeInTheDocument();
  });

  it('recalcula o percentual de liberdade ao marcar mais uma assinatura', () => {
    renderInFamily(<FamilyLandingPage />);
    // Padrão: R$ 60.000 a 8% a.a. = R$ 400/mês contra R$ 283,80 de assinaturas.
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Academia (R$ 129,90) leva o total a R$ 413,70 — o rendimento não cobre mais tudo.
    fireEvent.click(screen.getByRole('button', { name: /Academia/ }));
    expect(screen.getByText('97%')).toBeInTheDocument();
  });

  it('reage ao cenário de rendimento escolhido', () => {
    renderInFamily(<FamilyLandingPage />);
    fireEvent.click(screen.getByRole('button', { name: '6% a.a.' }));
    // 60.000 a 6% = R$ 300/mês contra R$ 283,80 — ainda cobre tudo.
    expect(screen.getByText('100%')).toBeInTheDocument();
    // "Suas assinaturas" e "Coberto no cenário" mostram o mesmo valor aqui.
    expect(screen.getAllByText('R$ 283,80')).toHaveLength(2);
  });

  it('exige e-mail válido na lista de espera', () => {
    renderInFamily(<FamilyLandingPage />);
    const submit = screen.getByRole('button', { name: 'Entrar na lista' });

    fireEvent.change(screen.getByLabelText('Seu e-mail'), { target: { value: 'ana' } });
    fireEvent.click(submit);
    expect(screen.getByRole('alert')).toHaveTextContent('Digite um e-mail válido');

    fireEvent.change(screen.getByLabelText('Seu e-mail'), { target: { value: 'ana@email.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na lista' }));
    expect(screen.getByRole('button', { name: 'Pronto — a gente avisa você' })).toBeInTheDocument();
  });
});

describe('painel /family/dashboard', () => {
  it('sem depósito, nenhuma assinatura está coberta', () => {
    renderInFamily(<FamilyDashboardPage />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getAllByText('ainda não')).toHaveLength(4);
  });

  it('com depósito, cobre as contas do topo da lista primeiro', () => {
    // R$ 30.000 a 8% a.a. = R$ 200/mês: cobre Netflix (59,90) e Spotify (34,90),
    // mas o acumulado do ChatGPT (201,80) já passa do rendimento.
    updateFamilyStore((prev) => ({ ...prev, deposit: 30000 }));
    renderInFamily(<FamilyDashboardPage />);

    expect(screen.getAllByText('coberta')).toHaveLength(2);
    expect(screen.getAllByText('ainda não')).toHaveLength(2);
  });

  it('adiciona uma assinatura à lista da casa', () => {
    renderInFamily(<FamilyDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar assinatura' }));

    fireEvent.change(screen.getByLabelText('Nome da assinatura'), {
      target: { value: 'Escola de inglês' },
    });
    fireEvent.change(screen.getByLabelText('Valor mensal'), { target: { value: '189' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(screen.getByText('Escola de inglês')).toBeInTheDocument();
    // 59,90 + 34,90 + 107 + 129,90 + 189 = R$ 520,70
    expect(screen.getByText('Total de R$ 520,70 por mês')).toBeInTheDocument();
  });

  it('leva ao detalhe da assinatura clicada', () => {
    renderInFamily(<FamilyDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /Netflix/ }));
    expect(push).toHaveBeenCalledWith('/family/dashboard/netflix');
  });

  it('leva ao depósito e ao saque pelos botões do cofre', () => {
    renderInFamily(<FamilyDashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Depositar por PIX' }));
    expect(push).toHaveBeenCalledWith('/family/deposito');

    fireEvent.click(screen.getByRole('button', { name: 'Sacar meu saldo' }));
    expect(push).toHaveBeenCalledWith('/family/saque');
  });
});
