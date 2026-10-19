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
});
