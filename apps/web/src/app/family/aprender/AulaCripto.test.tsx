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

function page(title: string, body: string) {
  return `<!doctype html><html><head><style>h1{margin:0}</style></head><body><header class="top"></header><div class="hero"><h1>${title}</h1></div><main><p>${body}</p></main><div class="video">Assista à versão em vídeo</div></body></html>`;
}

function htmlResponse(source: string) {
  return { status: 200, ok: true, text: async () => source, json: async () => ({}) };
}

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
        if (path.includes('aula-01')) return htmlResponse(page('O que é criptomoeda?', 'Dinheiro que nasceu digital'));
        if (path.includes('aula-02')) return htmlResponse(page('Blockchain: o caderno que ninguém apaga', 'Um caderno compartilhado'));
        return json({});
      }),
    );
  });

  it('mostra o vídeo e a leitura da aula, e troca quando muda de aula', async () => {
    render(<AulaCripto />);
    expect(await screen.findByRole('heading', { name: 'Cripto do zero' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'O que é criptomoeda?', level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText('Vídeo da aula')).toBeInTheDocument();
    expect(await screen.findByText('Dinheiro que nasceu digital')).toBeInTheDocument();
    expect(screen.queryByText('Assista à versão em vídeo')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Leitura:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Blockchain: o caderno que ninguém apaga/ }));
    expect(await screen.findByText('Um caderno compartilhado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como concluída' }));
    expect(await screen.findByRole('button', { name: 'Concluída ✓' })).toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/lesson-progress/beginner-2'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('mostra a trilha mesmo sem família criada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = String(url);
        if (path.includes('/household/profile')) return json({ message: 'not found' }, 404);
        if (path.includes('/lesson-progress')) return json([]);
        if (path.includes('/lessons')) {
          return json([{ id: 'beginner-1', title: 'O que é criptomoeda?', durationMinutes: 6 }]);
        }
        return json({});
      }),
    );
    render(<AulaCripto />);
    expect(await screen.findByRole('heading', { name: 'Cripto do zero' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'O que é criptomoeda?' })).toBeInTheDocument();
  });
});
