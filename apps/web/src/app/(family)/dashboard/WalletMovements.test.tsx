/**
 * Módulo: WalletMovements
 * Criado em: 2026-11-04
 * Última atualização: 2026-11-04
 * Intuito: O painel mostra os movimentos com origem, ativo, quantidade, valor ou "sem valor em reais", tipo, marcação e filtro, sincronizando sob demanda e sem erro na tela.
 * Sequência: sem carteira, a seção não aparece; mostra origem, ativo, quantidade, valor e tipo; outro ativo diz "sem valor em reais"; filtra por classe, por sem valor e por transferência minha; marcar e desmarcar chama a API e recarrega os totais; quem não adicionou não vê o botão; sync com novidades recarrega; 429 fica em "atualizando", sem erro, e pede de novo depois; falha de rede não vira erro; o botão atualizar sincroniza de novo; trocar o mês busca de novo; a API sem a rota não quebra o painel.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalletMovementView } from '@yield2pay/shared';
import { matchesMovement, WalletMovements } from './WalletMovements';

const base: WalletMovementView = {
  id: 'm1',
  date: '2026-10-05',
  walletId: 'w1',
  origin: 'Carteira Nubank',
  opType: 'payment',
  direction: 'out',
  asset: 'XLM',
  quantity: '10',
  valueCents: 2500,
  movementClass: 'expense',
  ownTransfer: false,
  canMarkTransfer: true,
};
const income = { ...base, id: 'm2', direction: 'in', movementClass: 'income', valueCents: 25000, quantity: '100' } as WalletMovementView;
const other = { ...base, id: 'm3', direction: 'in', movementClass: 'income', asset: 'AQUA (G...ABCD)', quantity: '77', valueCents: null, canMarkTransfer: false } as WalletMovementView;
const conversion = { ...base, id: 'm4', opType: 'path_payment_strict_send', direction: 'none', movementClass: 'conversion', valueCents: null, canMarkTransfer: false } as WalletMovementView;
const info = { ...base, id: 'm5', opType: 'change_trust', direction: 'none', movementClass: 'info', asset: null, quantity: null, valueCents: null, canMarkTransfer: false } as WalletMovementView;

function json(body: unknown, status = 200) {
  const text = body == null ? '' : JSON.stringify(body);
  return { status, ok: status < 400, text: async () => text, json: async () => body };
}

function setup(options: {
  items?: WalletMovementView[];
  sync?: unknown;
  syncFails?: boolean;
} = {}) {
  const items = options.items ?? [base, income, other, conversion, info];
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith('/household-wallets/sync')) {
      if (options.syncFails) throw new Error('rede');
      return json(options.sync ?? { wallets: [{ id: 'w1', syncStatus: 'ok', retryAfterSeconds: null }], changed: false });
    }
    if (path.includes('/household-wallets/movements?')) return json({ items, truncated: false });
    if (path.includes('/household-wallets/movements/')) return json(null, 204);
    return json({});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof setup>, part: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes(part));

const props = { month: '2026-10', reloadKey: 0, getToken: async () => null };

describe('movimentos das carteiras', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sem carteira, a seção não aparece', async () => {
    const fetchMock = setup({ items: [], sync: { wallets: [], changed: false } });
    const { container } = render(<WalletMovements {...props} />);
    await waitFor(() => expect(callsTo(fetchMock, '/sync').length).toBe(1));
    await waitFor(() => expect(callsTo(fetchMock, '/movements').length).toBe(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra origem, ativo, quantidade, valor e tipo', async () => {
    setup();
    render(<WalletMovements {...props} />);
    expect((await screen.findAllByText('Carteira Nubank')).length).toBe(5);
    expect(screen.getByText('10 XLM', { selector: '.y2p-wallet:first-child *' })).toBeInTheDocument();
    expect(screen.getByText('R$ 25,00')).toBeInTheDocument();
    expect(screen.getByText('Pagamento · Enviado')).toBeInTheDocument();
    expect(screen.getAllByText('Pagamento · Recebido').length).toBe(2);
    expect(screen.getByText('Pagamento com troca · Conversão')).toBeInTheDocument();
    expect(screen.getByText('Autorização de ativo · Informativo')).toBeInTheDocument();
  });

  it('outro ativo diz "sem valor em reais"', async () => {
    setup({ items: [other] });
    render(<WalletMovements {...props} />);
    expect(await screen.findByText('sem valor em reais')).toBeInTheDocument();
    expect(screen.getByText('77 AQUA (G...ABCD)')).toBeInTheDocument();
  });

  it('menos de um centavo não vira R$ 0,00', async () => {
    setup({ items: [{ ...base, valueCents: 0, canMarkTransfer: false }] });
    render(<WalletMovements {...props} />);
    expect(await screen.findByText('menos de 1 centavo')).toBeInTheDocument();
  });

  it('filtra por classe, por sem valor e por transferência minha', async () => {
    setup({ items: [base, income, other, conversion, info, { ...base, id: 'm6', ownTransfer: true }] });
    render(<WalletMovements {...props} />);
    await screen.findAllByText('Carteira Nubank');
    const group = screen.getByRole('group', { name: 'Filtrar movimentos' });
    const rows = () => document.querySelectorAll('.y2p-wallet').length;
    expect(rows()).toBe(6);
    fireEvent.click(within(group).getByRole('button', { name: 'Gastos' }));
    expect(rows()).toBe(2);
    fireEvent.click(within(group).getByRole('button', { name: 'Entradas' }));
    expect(rows()).toBe(2);
    fireEvent.click(within(group).getByRole('button', { name: 'Conversões' }));
    expect(rows()).toBe(1);
    fireEvent.click(within(group).getByRole('button', { name: 'Informativos' }));
    expect(rows()).toBe(1);
    fireEvent.click(within(group).getByRole('button', { name: 'Sem valor' }));
    expect(rows()).toBe(3);
    fireEvent.click(within(group).getByRole('button', { name: 'Transferência minha' }));
    expect(rows()).toBe(1);
    fireEvent.click(within(group).getByRole('button', { name: 'Todos' }));
    expect(rows()).toBe(6);
  });

  it('matchesMovement não confunde as classes', () => {
    expect(matchesMovement(conversion, 'gastos')).toBe(false);
    expect(matchesMovement(info, 'sem-valor')).toBe(true);
    expect(matchesMovement(base, 'sem-valor')).toBe(false);
  });

  it('marcar e desmarcar chama a API e recarrega os totais', async () => {
    const fetchMock = setup({ items: [base, { ...income, ownTransfer: true }] });
    const onExpensesChanged = vi.fn();
    render(<WalletMovements {...props} onExpensesChanged={onExpensesChanged} />);
    const buttons = await screen.findAllByRole('button', { name: 'Transferência minha', pressed: false });
    const marks = buttons.filter((button) => button.closest('.y2p-wallet'));
    fireEvent.click(marks[0] as HTMLElement);
    await waitFor(() => expect(onExpensesChanged).toHaveBeenCalledTimes(1));
    const mark = callsTo(fetchMock, '/household-wallets/movements/m1')[0];
    expect(mark?.[1]?.method).toBe('PATCH');
    expect(JSON.parse(String(mark?.[1]?.body))).toEqual({ ownTransfer: true });

    fireEvent.click(screen.getAllByRole('button', { name: 'Transferência minha', pressed: true }).filter((button) => button.closest('.y2p-wallet'))[0] as HTMLElement);
    await waitFor(() => expect(onExpensesChanged).toHaveBeenCalledTimes(2));
    const unmark = callsTo(fetchMock, '/household-wallets/movements/m2')[0];
    expect(JSON.parse(String(unmark?.[1]?.body))).toEqual({ ownTransfer: false });
  });

  it('quem não adicionou não vê o botão, mas vê a marca', async () => {
    setup({ items: [{ ...base, canMarkTransfer: false, ownTransfer: true }] });
    render(<WalletMovements {...props} />);
    const row = (await screen.findByText('Carteira Nubank')).closest('.y2p-wallet') as HTMLElement;
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    expect(within(row).getByText('Transferência minha')).toBeInTheDocument();
  });

  it('sync com novidades recarrega a lista e os totais', async () => {
    const fetchMock = setup({ sync: { wallets: [{ id: 'w1', syncStatus: 'ok', retryAfterSeconds: null }], changed: true } });
    const onExpensesChanged = vi.fn();
    render(<WalletMovements {...props} onExpensesChanged={onExpensesChanged} />);
    await waitFor(() => expect(onExpensesChanged).toHaveBeenCalledTimes(1));
    expect(callsTo(fetchMock, '/movements?').length).toBeGreaterThanOrEqual(2);
  });

  it('429 fica em "atualizando", sem erro, e pede de novo depois', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = setup({ sync: { wallets: [{ id: 'w1', syncStatus: 'updating', retryAfterSeconds: 120 }], changed: false } });
    render(<WalletMovements {...props} />);
    expect(await screen.findByText(/atualizando/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(callsTo(fetchMock, '/sync').length).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(119_000);
    });
    expect(callsTo(fetchMock, '/sync').length).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(callsTo(fetchMock, '/sync').length).toBe(2);
  });

  it('falha de rede não vira erro', async () => {
    const fetchMock = setup({ syncFails: true });
    render(<WalletMovements {...props} />);
    expect((await screen.findAllByText('Carteira Nubank')).length).toBe(5);
    expect(callsTo(fetchMock, '/sync').length).toBe(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('o botão atualizar sincroniza de novo', async () => {
    const fetchMock = setup();
    render(<WalletMovements {...props} />);
    await screen.findAllByText('Carteira Nubank');
    await waitFor(() => expect(callsTo(fetchMock, '/sync').length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    await waitFor(() => expect(callsTo(fetchMock, '/sync').length).toBe(2));
  });

  it('trocar o mês e usar um período buscam de novo, sem novo sync', async () => {
    const fetchMock = setup();
    const { rerender } = render(<WalletMovements {...props} />);
    await screen.findAllByText('Carteira Nubank');
    expect(callsTo(fetchMock, 'movements?month=2026-10').length).toBe(1);
    rerender(<WalletMovements {...props} month="2026-09" />);
    await waitFor(() => expect(callsTo(fetchMock, 'movements?month=2026-09').length).toBe(1));
    rerender(<WalletMovements {...props} month="2026-09" from="2026-08-01" to="2026-08-20" />);
    await waitFor(() => expect(callsTo(fetchMock, 'from=2026-08-01&to=2026-08-20').length).toBe(1));
    expect(callsTo(fetchMock, '/sync').length).toBe(1);
  });

  it('a API sem a rota não quebra o painel', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'x' }, 404)));
    const { container } = render(<WalletMovements {...props} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container).toBeEmptyDOMElement();
  });
});
