/**
 * Módulo: conta
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: Configurações salvam o nome, avisam o painel fora do render e travam as ações perigosas.
 * Sequência: mostra o e-mail e salva o nome; atualiza o painel depois de mudar a trilha, fora do render; salva o nome com Enter e avisa quando o nome fica vazio; não oferece saída ao único admin e exige APAGAR exato.
 */
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContaModal } from './ContaModal';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => null, logout: vi.fn() }),
}));

const account = {
  displayName: 'Marina',
  fullName: 'Marina Souza',
  email: 'marina.souza@gmail.com',
  initials: 'MS',
  accountType: 'family',
  household: { id: 'h1', name: 'Família Souza', role: 'owner', onboardingCompleted: true },
};

function json(body: unknown, status = 200) {
  const text = body == null ? '' : JSON.stringify(body);
  return { status, ok: status < 400, text: async () => text, json: async () => body };
}

describe('configurações da conta', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = String(url);
        if (path.endsWith('/account') && init?.method === 'PATCH') {
          return json({ ...account, displayName: 'Marina Lima' });
        }
        if (path.endsWith('/account')) return json(account);
        if (path.includes('/household/profile')) {
          return json({
            householdSize: 'two',
            monthlyIncomeCents: 1_200_000,
            reserveCents: 3_000_000,
            priorities: [],
            goalMonths: 12,
            cryptoExperience: 'beginner',
            onboardingCompleted: true,
          });
        }
        if (path.includes('/people')) {
          return json([
            { id: 'co_1', email: 'marina.souza@gmail.com', displayName: 'Marina', role: 'owner', you: true },
          ]);
        }
        return json({});
      }),
    );
  });

  it('mostra o e-mail e salva o nome', async () => {
    render(<ContaModal open onClose={() => undefined} getToken={async () => null} />);
    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
    expect(screen.getAllByText('marina.souza@gmail.com').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Nome na plataforma'), { target: { value: 'Marina Lima' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Nome atualizado');
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/account'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('atualiza o painel depois de mudar a trilha, fora do render', async () => {
    const errors: unknown[][] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args);
    });
    function Harness() {
      const [experience, setExperience] = useState('beginner');
      return (
        <>
          <p>experiencia:{experience}</p>
          <ContaModal
            open
            onClose={() => undefined}
            getToken={async () => null}
            onProfile={(next) => setExperience(next.cryptoExperience)}
          />
        </>
      );
    }
    render(<Harness />);
    expect(await screen.findByText('marina.souza@gmail.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aulas' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Trilha de investimento' }));
    expect(await screen.findByText('experiencia:declined')).toBeInTheDocument();
    expect(errors.some((args) => args.some((arg) => String(arg).includes('Cannot update a component')))).toBe(false);
    spy.mockRestore();
  });

  it('salva o nome com Enter e avisa quando o nome fica vazio', async () => {
    render(<ContaModal open onClose={() => undefined} getToken={async () => null} />);
    const name = await screen.findByLabelText('Nome na plataforma');
    fireEvent.change(name, { target: { value: 'Marina Lima' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(await screen.findByRole('status')).toHaveTextContent('Nome atualizado');
    fireEvent.change(screen.getByLabelText('Nome na plataforma'), { target: { value: '   ' } });
    const warning = screen.getByText('Informe um nome.');
    expect(warning).toBeInTheDocument();
    expect(name.parentElement).not.toContainElement(warning);
    expect(name.parentElement?.parentElement).toContainElement(warning);
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
  });

  it('não oferece saída ao único admin e exige APAGAR exato', async () => {
    render(<ContaModal open onClose={() => undefined} getToken={async () => null} />);
    expect(await screen.findByText('marina.souza@gmail.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Grupo' }));
    expect(screen.getByText(/única pessoa do grupo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sair do grupo' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Conta e dados' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apagar gastos' }));
    const confirm = screen.getByRole('textbox', { name: 'Digite APAGAR' });
    fireEvent.change(confirm, { target: { value: ' apagar ' } });
    expect(screen.getByRole('button', { name: 'Apagar para sempre' })).toBeDisabled();
    fireEvent.change(confirm, { target: { value: 'APAGAR' } });
    expect(screen.getByRole('button', { name: 'Apagar para sempre' })).toBeEnabled();
  });
});
