/**
 * Módulo: WalletsSection
 * Criado em: 2026-11-04
 * Última atualização: 2026-11-04
 * Intuito: Conta > Carteiras adiciona, lista só mascarado e remove, com o aviso de só leitura, e nunca repete o que foi digitado.
 * Sequência: mostra o aviso de só leitura e a lista mascarada; adiciona com endereço, apelido e rede, e limpa o campo; endereço recusado mostra a mensagem do status sem repetir o valor; conta inexistente avisa pela rede; só oferece remover para quem adicionou, e remover chama a API e avisa o painel; a aba aparece nas configurações.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletsSection } from './WalletsSection';
import { ContaModal } from './ContaModal';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const FULL_ADDRESS = 'GAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBLOC';
const SECRET = 'SABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFXRV';

const mine = {
  id: 'w1',
  label: 'Nubank',
  network: 'public',
  maskedAddress: 'G...BLOC',
  syncStatus: 'ok',
  lastSyncedAt: null,
  canManage: true,
};
const theirs = { ...mine, id: 'w2', label: 'Da Bia', canManage: false, syncStatus: 'updating' };

function json(body: unknown, status = 200) {
  const text = body == null ? '' : JSON.stringify(body);
  return { status, ok: status < 400, text: async () => text, json: async () => body };
}

function setup(addStatus = 201) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith('/household-wallets') && init?.method === 'POST') {
      if (addStatus >= 400) return json({ message: 'x' }, addStatus);
      return json({ ...mine, id: 'w3', label: 'Reserva' }, 201);
    }
    if (String(url).includes('/household-wallets/') && init?.method === 'DELETE') return json(null, 204);
    if (String(url).endsWith('/household-wallets')) return json([mine, theirs]);
    return json({});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const props = { getToken: async () => null, onToast: vi.fn() };

describe('Conta > Carteiras', () => {
  beforeEach(() => {
    props.onToast.mockClear();
  });

  it('mostra o aviso de só leitura e a lista mascarada', async () => {
    setup();
    render(<WalletsSection {...props} />);
    expect(screen.getByText(/só leitura, nunca pedimos sua chave secreta/i)).toBeInTheDocument();
    expect(await screen.findByText('Nubank')).toBeInTheDocument();
    expect(screen.getAllByText('G...BLOC')).toHaveLength(2);
    expect(screen.getByText(/Em dia/)).toBeInTheDocument();
    expect(screen.getByText(/Atualizando/)).toBeInTheDocument();
  });

  it('adiciona com endereço, apelido e rede, e limpa o campo', async () => {
    const fetchMock = setup();
    const onChanged = vi.fn();
    render(<WalletsSection {...props} onChanged={onChanged} />);
    await screen.findByText('Nubank');
    const address = screen.getByLabelText('Endereço da carteira');
    fireEvent.change(address, { target: { value: FULL_ADDRESS } });
    fireEvent.change(screen.getByLabelText('Apelido da carteira'), { target: { value: 'Reserva' } });
    fireEvent.change(screen.getByLabelText('Rede da carteira'), { target: { value: 'testnet' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('Reserva')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ address: FULL_ADDRESS, label: 'Reserva', network: 'testnet' });
    expect(address).toHaveValue('');
    expect(onChanged).toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(FULL_ADDRESS);
  });

  it('endereço recusado mostra a mensagem do status sem repetir o valor', async () => {
    setup(400);
    render(<WalletsSection {...props} />);
    await screen.findByText('Nubank');
    fireEvent.change(screen.getByLabelText('Endereço da carteira'), { target: { value: SECRET } });
    fireEvent.change(screen.getByLabelText('Apelido da carteira'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Endereço ou apelido inválido');
    expect(alert.textContent).not.toContain(SECRET);
  });

  it('conta inexistente avisa pela rede', async () => {
    setup(404);
    render(<WalletsSection {...props} />);
    await screen.findByText('Nubank');
    fireEvent.change(screen.getByLabelText('Endereço da carteira'), { target: { value: FULL_ADDRESS } });
    fireEvent.change(screen.getByLabelText('Apelido da carteira'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Conta não encontrada nesta rede.');
  });

  it('pede os dois campos antes de chamar a API', async () => {
    const fetchMock = setup();
    render(<WalletsSection {...props} />);
    await screen.findByText('Nubank');
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o endereço e o apelido.');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('só oferece remover para quem adicionou, e remover chama a API e avisa o painel', async () => {
    const fetchMock = setup();
    const onChanged = vi.fn();
    render(<WalletsSection {...props} onChanged={onChanged} />);
    await screen.findByText('Nubank');
    expect(screen.queryByRole('button', { name: 'Remover Da Bia' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover Nubank' }));

    await waitFor(() => expect(screen.queryByText('Nubank')).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/household-wallets/w1') && init?.method === 'DELETE')).toBe(true);
    expect(onChanged).toHaveBeenCalled();
  });

  it('a aba aparece nas configurações', async () => {
    const account = {
      displayName: 'Marina',
      fullName: 'Marina Souza',
      email: 'm@example.test',
      initials: 'MS',
      accountType: 'family',
      households: [{ id: 'h1', name: 'Casa', role: 'owner', personal: true }],
      activeHousehold: { id: 'h1', name: 'Casa', role: 'owner', personal: true, onboardingCompleted: true },
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const path = String(url);
      if (path.endsWith('/household-wallets')) return json([mine]);
      if (path.endsWith('/account')) return json(account);
      if (path.includes('/household/profile')) return json({ cryptoExperience: 'beginner' });
      if (path.includes('/people')) return json([]);
      return json({});
    }));
    render(<ContaModal open onClose={() => undefined} getToken={async () => null} />);
    await screen.findByText('m@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Carteiras' }));
    expect(await screen.findByText('Nubank')).toBeInTheDocument();
  });
});
