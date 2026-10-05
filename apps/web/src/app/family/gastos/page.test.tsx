import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FamilyProvider } from '../_lib/FamilyProvider';

const api = vi.hoisted(() => ({
  listMonthExpenses: vi.fn(),
  listContas: vi.fn(),
  createConta: vi.fn(),
  jaGastei: vi.fn(),
  confirmNota: vi.fn(),
}));
const privy = vi.hoisted(() => ({ configured: true }));

vi.mock('@/lib/api', () => ({
  createApi: () => api,
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number) {
      super(String(status));
      this.status = status;
    }
  },
}));
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'tok' }),
}));
vi.mock('@/providers/PrivyProviderWrapper', () => ({
  get isPrivyConfigured() {
    return privy.configured;
  },
}));

import GastosPage from './page';

const KEY = '35261000000000000191650010000000011000000013';

function renderPage() {
  return render(
    <FamilyProvider>
      <GastosPage />
    </FamilyProvider>,
  );
}

beforeEach(() => {
  privy.configured = true;
  api.listMonthExpenses.mockReset().mockResolvedValue({ month: '2026-10', expenses: [] });
  api.listContas.mockReset().mockResolvedValue([]);
  api.createConta.mockReset();
  api.jaGastei.mockReset();
  api.confirmNota.mockReset();
});

describe('/family/gastos', () => {
  it('lists the current month with amount, merchant, date, source, and category', async () => {
    api.listMonthExpenses.mockResolvedValue({
      month: '2026-10',
      expenses: [
        {
          id: 'e1',
          amountCents: 17119,
          merchant: 'MERCADO EXEMPLO',
          spentOn: '2026-10-04',
          source: 'nota',
          category: 'mercado',
        },
      ],
    });
    renderPage();
    const list = await screen.findByRole('list', { name: 'Gastos do mês' });
    expect(within(list).getByText('MERCADO EXEMPLO')).toBeInTheDocument();
    expect(within(list).getByText('R$ 171,19')).toBeInTheDocument();
    expect(within(list).getByText('04/10/2026')).toBeInTheDocument();
    expect(within(list).getByText('Nota · Mercado')).toBeInTheDocument();
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows an empty month', async () => {
    renderPage();
    expect(await screen.findByText('Nenhum gasto neste mês.')).toBeInTheDocument();
  });

  it('saves a recurring account without posting a month row', async () => {
    api.createConta.mockResolvedValue({ id: 'c1', name: 'Luz', amountCents: 15000, spentThisMonth: false });
    renderPage();
    fireEvent.change(await screen.findByLabelText('Nome da conta'), { target: { value: 'Luz' } });
    fireEvent.change(screen.getByLabelText('Valor da conta'), { target: { value: '150,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar conta' }));
    expect(await screen.findByRole('button', { name: 'já gastei Luz' })).toBeInTheDocument();
    expect(api.createConta).toHaveBeenCalledWith({ name: 'Luz', amountCents: 15000 });
    expect(api.jaGastei).not.toHaveBeenCalled();
    expect(api.confirmNota).not.toHaveBeenCalled();
    expect(screen.getByText('Nenhum gasto neste mês.')).toBeInTheDocument();
  });

  it('posts já gastei once, with the category chosen on confirm', async () => {
    api.listContas.mockResolvedValue([{ id: 'c1', name: 'Luz', amountCents: 15000, spentThisMonth: false }]);
    api.jaGastei.mockResolvedValue({
      id: 'e1',
      amountCents: 15000,
      merchant: 'Luz',
      spentOn: '2026-10-04',
      source: 'conta',
      category: 'conta_da_casa',
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'já gastei Luz' }));
    fireEvent.change(screen.getByLabelText('Categoria do gasto'), { target: { value: 'conta_da_casa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar gasto' }));
    expect(api.jaGastei).toHaveBeenCalledWith('c1', { category: 'conta_da_casa' });
    const list = await screen.findByRole('list', { name: 'Gastos do mês' });
    expect(within(list).getByText('04/10/2026')).toBeInTheDocument();
    expect(within(list).getByText('Conta · Conta da casa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Já lançado neste mês' })).toBeDisabled();
  });

  it('does not call já gastei when this month already has the row', async () => {
    api.listContas.mockResolvedValue([{ id: 'c1', name: 'Luz', amountCents: 15000, spentThisMonth: true }]);
    renderPage();
    const button = await screen.findByRole('button', { name: 'Já lançado neste mês' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(api.jaGastei).not.toHaveBeenCalled();
  });

  it('keeps the receipt as a preview until confirm, and stores the key when present', async () => {
    api.confirmNota.mockResolvedValue({
      id: 'e2',
      amountCents: 1990,
      merchant: 'Padaria',
      spentOn: '2026-10-04',
      source: 'nota',
      category: 'mercado',
    });
    renderPage();
    fireEvent.change(await screen.findByLabelText('Estabelecimento'), { target: { value: 'Padaria' } });
    fireEvent.change(screen.getByLabelText('Valor da nota'), { target: { value: '19,90' } });
    fireEvent.change(screen.getByLabelText('Data da nota'), { target: { value: '2026-10-04' } });
    fireEvent.change(screen.getByLabelText('Chave de acesso'), { target: { value: KEY } });
    expect(api.confirmNota).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Categoria da nota'), { target: { value: 'mercado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nota' }));
    expect(api.confirmNota).toHaveBeenCalledWith({
      merchant: 'Padaria',
      amountCents: 1990,
      spentOn: '2026-10-04',
      category: 'mercado',
      accessKey: KEY,
    });
  });

  it('confirms a receipt without an access key', async () => {
    api.confirmNota.mockResolvedValue({
      id: 'e3',
      amountCents: 1000,
      merchant: 'Feira',
      spentOn: '2026-10-04',
      source: 'nota',
      category: 'outros',
    });
    renderPage();
    fireEvent.change(await screen.findByLabelText('Estabelecimento'), { target: { value: 'Feira' } });
    fireEvent.change(screen.getByLabelText('Valor da nota'), { target: { value: '10,00' } });
    fireEvent.change(screen.getByLabelText('Data da nota'), { target: { value: '2026-10-04' } });
    fireEvent.change(screen.getByLabelText('Categoria da nota'), { target: { value: 'outros' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nota' }));
    expect(api.confirmNota).toHaveBeenCalledWith({
      merchant: 'Feira',
      amountCents: 1000,
      spentOn: '2026-10-04',
      category: 'outros',
    });
  });

  it('asks the person to sign in when Privy is not configured', () => {
    privy.configured = false;
    renderPage();
    expect(screen.getByText('Entre com sua conta para ver os gastos do mês.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar nota' })).not.toBeInTheDocument();
  });
});
