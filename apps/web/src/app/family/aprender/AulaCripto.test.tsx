import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AulaCripto from './AulaCripto';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('aula=1'),
}));

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => null }),
}));

const profile = {
  householdSize: 'two',
  monthlyIncomeCents: 1_200_000,
  reserveCents: 3_000_000,
  priorities: [],
  goalMonths: 12,
  cryptoExperience: 'beginner',
  onboardingCompleted: true,
};

function json(body: unknown, status = 200) {
  const text = body == null ? '' : JSON.stringify(body);
  return { status, ok: status < 400, text: async () => text, json: async () => body };
}

describe('trilha de aulas', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = String(url);
        if (path.includes('/lesson-progress') && init?.method === 'PUT') return json(null, 204);
        if (path.includes('/household/profile')) return json(profile);
        if (path.includes('/lesson-progress')) return json([]);
        if (path.includes('/lessons')) {
          return json([
            { id: 'beginner-1', title: 'O que é uma carteira', durationMinutes: 4 },
            { id: 'beginner-2', title: 'Custódia das suas chaves', durationMinutes: 5 },
            { id: 'beginner-3', title: 'O que é um cofre', durationMinutes: 6 },
            { id: 'beginner-4', title: 'Por que o rendimento não é gasto', durationMinutes: 4 },
          ]);
        }
        return json({});
      }),
    );
  });

  it('abre a aula pedida e marca como concluída', async () => {
    render(<AulaCripto />);
    expect(await screen.findByRole('heading', { name: 'Cripto sem pressa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'O que é cripto, sem jargão' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '▶ Assistir aula' }));
    expect(await screen.findByRole('dialog', { name: 'Aula' })).toBeInTheDocument();
    expect(screen.getByText('Dinheiro digital')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como concluída' }));
    expect(await screen.findByRole('button', { name: 'Concluída ✓' })).toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/lesson-progress/beginner-1'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
