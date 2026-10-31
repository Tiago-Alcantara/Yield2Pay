/**
 * Módulo: AulaCripto
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: A trilha mostra as aulas, o teste e o estado de cada uma.
 * Sequência: mostra o vídeo e a leitura da aula, e troca quando muda de aula; abre a aula pedida na URL, não a última salva no navegador; avisa quais aulas faltam e não libera o investimento; mostra a trilha mesmo sem família criada.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AulaCripto from './AulaCripto';
import { PLAYBACK_KEY } from './player';

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  aula: '1',
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(`aula=${nav.aula}`),
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
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
  return `<!doctype html><html><head><style>h1{margin:0}</style></head><body><header class="top"></header><div class="hero"><h1>${title}</h1></div><main><p>${body}</p><div class="quiz"><div class="card q" data-answer="1"><p class="qq">O que liga um bloco?</p><div class="opts"><button type="button" data-i="0"><span class="l">A</span><span>A data</span></button><button type="button" data-i="1"><span class="l">B</span><span>O hash</span></button></div><p class="why"><strong>Resposta: B.</strong> O hash liga os blocos.</p></div></div></main><div class="video">Assista à versão em vídeo</div></body></html>`;
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
    nav.aula = '1';
    nav.replace.mockReset();
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
        if (path.includes('/aulas-cripto/')) return htmlResponse(page('Aula', 'Texto da aula'));
        return json({});
      }),
    );
  });

  it('mostra o vídeo e a leitura da aula, e troca quando muda de aula', async () => {
    render(<AulaCripto />);
    expect(await screen.findByRole('heading', { name: 'Cripto do zero' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'O que é criptomoeda?', level: 2 })).toBeInTheDocument();
    const video = screen.getByLabelText('Vídeo da aula');
    expect(video.getAttribute('src') ?? '').not.toContain('raw.githubusercontent.com');
    expect(video.getAttribute('src')).toContain('cdn.jsdelivr.net');
    expect(video.querySelector('track')?.getAttribute('kind')).toBe('captions');
    await screen.findByText('Dinheiro que nasceu digital');
    expect(screen.getByText('Dinheiro que nasceu digital')).toBeInTheDocument();
    expect(screen.queryByText('Assista à versão em vídeo')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Leitura:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Blockchain: o caderno que ninguém apaga/ }));
    await screen.findByText('Um caderno compartilhado');
    expect(screen.getByText('Um caderno compartilhado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como concluída' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Acerte todas as perguntas');
    fireEvent.click(screen.getByRole('button', { name: /A data/ }));
    expect(screen.getByText(/Não foi essa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /O hash/ }));
    expect(screen.getByText(/Acertou/)).toBeInTheDocument();
    expect(screen.queryByText(/Não foi essa/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como concluída' }));
    expect(await screen.findByRole('button', { name: 'Concluída ✓' })).toBeInTheDocument();
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/lesson-progress/beginner-2'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ completed: true, answers: [1] }) }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Concluída ✓' }));
    expect(screen.getByRole('button', { name: 'Manter concluída' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como concluída' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar' }));
    expect(await screen.findByRole('button', { name: 'Marcar como concluída' })).toBeInTheDocument();
  });

  it('abre a aula pedida na URL, não a última salva no navegador', async () => {
    nav.aula = '4';
    window.localStorage.setItem(PLAYBACK_KEY, JSON.stringify({ li: 6, pos: [0, 0, 0, 0, 0, 0, 0] }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = String(url);
      if (path.includes('/household/profile')) return json(profile);
      if (path.includes('/lesson-progress')) return json([]);
      if (path.includes('/lessons')) {
        return json([
          'beginner-1', 'beginner-2', 'beginner-3', 'beginner-4', 'beginner-5', 'beginner-6', 'beginner-7',
        ].map((id) => ({ id, title: id, durationMinutes: 5 })));
      }
      if (path.includes('/aulas-cripto/')) return htmlResponse(page('Aula', 'Texto da aula'));
      return json({});
    }));
    render(<AulaCripto />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Chaves, endereço e frase de recuperação' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /Vault da DeFindex/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /O que é criptomoeda/ }));
    expect(nav.replace).toHaveBeenCalledWith('/aprender?aula=1', { scroll: false });
    expect(await screen.findByRole('heading', { level: 2, name: 'O que é criptomoeda?' })).toBeInTheDocument();
  });

  it('avisa quais aulas faltam e não libera o investimento', async () => {
    render(<AulaCripto />);
    fireEvent.click(await screen.findByRole('button', { name: /Chaves, endereço e frase de recuperação/ }));
    expect(await screen.findByText('O que liga um bloco?')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /O hash/ })).toBeEnabled();
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Concluir trilha' }));
    expect(await screen.findByText(/Acerte todas as perguntas/)).toBeInTheDocument();
    expect(screen.queryByText(/está liberado/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /O hash/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir trilha' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ainda faltam as aulas 1, 2 e 3');
    expect(screen.queryByText(/está liberado/)).not.toBeInTheDocument();
  });

  it('A-06: o clique do chip e o Próxima gravam ?aula e a reabertura volta na mesma', async () => {
    nav.aula = '4';
    nav.replace.mockImplementation((url: string) => {
      nav.aula = new URL(url, 'http://localhost').searchParams.get('aula') ?? nav.aula;
    });
    const view = render(<AulaCripto />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Chaves, endereço e frase de recuperação' })).toBeInTheDocument();
    expect(screen.getByLabelText('Aula atual')).toHaveTextContent('Aula 4 de');
    fireEvent.click(screen.getByRole('button', { name: /O que é criptomoeda/ }));
    expect(nav.replace).toHaveBeenCalledWith('/aprender?aula=1', { scroll: false });
    expect(await screen.findByRole('heading', { level: 2, name: 'O que é criptomoeda?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Aula atual')).toHaveTextContent('Aula 1 de');
    view.unmount();
    nav.replace.mockClear();
    render(<AulaCripto />);
    expect(await screen.findByRole('heading', { level: 2, name: 'O que é criptomoeda?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Aula atual')).toHaveTextContent('Aula 1 de');
  });

  it('A-07: Aula anterior volta uma aula e atualiza ?aula', async () => {
    nav.aula = '2';
    render(<AulaCripto />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Blockchain: o caderno que ninguém apaga' })).toBeInTheDocument();
    expect(screen.getByLabelText('Aula atual')).toHaveTextContent('Aula 2 de');
    fireEvent.click(screen.getByRole('button', { name: 'Aula anterior' }));
    expect(nav.replace).toHaveBeenCalledWith('/aprender?aula=1', { scroll: false });
    expect(await screen.findByRole('heading', { level: 2, name: 'O que é criptomoeda?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aula anterior' })).toBeDisabled();
  });

  it('A-07: Próxima aula grava a aula seguinte na query depois do teste', async () => {
    render(<AulaCripto />);
    expect(await screen.findByText('O que liga um bloco?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /O hash/ }));
    expect(await screen.findByText(/Acertou/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima aula' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Blockchain: o caderno que ninguém apaga' })).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith('/aprender?aula=2', { scroll: false });
    expect(screen.getByLabelText('Aula atual')).toHaveTextContent('Aula 2 de');
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
