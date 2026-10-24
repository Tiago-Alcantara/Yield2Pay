/**
 * Módulo: DashboardPage
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: o painel da empresa carrega saldo, contas e o catálogo, e abre o aporte.
 * Sequência: espera o carregamento, mostra os números quando a API responde, mostra o erro em português, e o botão Aportar abre a gaveta de depósito.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- mock @/lib/api ---
const mockGetDashboard = vi.fn();
const mockListBills = vi.fn();
const mockGetWalletBalance = vi.fn();

vi.mock('@/lib/api', () => ({
  createApi: () => ({
    getDashboard: mockGetDashboard,
    listBills: mockListBills,
    getWalletBalance: mockGetWalletBalance,
  }),
}));

// Stub do MoveDrawer: vira um marcador clicável que dispara onSuccess.
vi.mock('@/components/MoveDrawer', () => ({
  MoveDrawer: ({ mode, onSuccess }: { mode: string; onSuccess: () => void }) => (
    <div data-testid="move-drawer">
      drawer:{mode}
      <button onClick={onSuccess}>drawer-success</button>
    </div>
  ),
}));

// --- mock @privy-io/react-auth (needed for createApi(getAccessToken) and logout) ---
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'mock-token', logout: vi.fn() }),
}));

// --- mock next/navigation ---
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/b2b/dashboard',
}));

import DashboardPage from './product-screen';

const T_ERROR = 'Erro ao carregar o painel.';

const DASHBOARD_DATA = {
  vaultValue: '10750000',
  principal: '10000000',
  spendable: '750000',
  apyPercent: '7.50',
};

const BILLS_DATA = [
  { id: 'b1', vendor: 'OpenAI', monthlyCost: '2000000', type: 'software', status: 'active' },
];

function setup() {
  mockGetDashboard.mockResolvedValue(DASHBOARD_DATA);
  mockListBills.mockResolvedValue(BILLS_DATA);
  mockGetWalletBalance.mockResolvedValue({ balance: '1200000000', spendable: '1185000000' });
  return render(<DashboardPage />);
}

describe('Dashboard page', () => {
  beforeEach(() => {
    mockGetDashboard.mockReset();
    mockListBills.mockReset();
    mockGetWalletBalance.mockReset();
    // Saldo é não-bloqueante: dá um default resolvido pros testes que não usam setup().
    mockGetWalletBalance.mockResolvedValue({ balance: '0', spendable: '0' });
  });

  it('shows loading state initially', () => {
    mockGetDashboard.mockReturnValue(new Promise(() => {})); // never resolves
    mockListBills.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
  });

  it('renders vaultValue via formatUsdc after data loads', async () => {
    setup();
    // O vault mostra formatUsdc('10750000') com cifrão: '$1.08'.
    await waitFor(() => {
      expect(screen.getByText('$1.08')).toBeInTheDocument();
    });
  });

  it('renders spendable via formatUsdc after data loads', async () => {
    setup();
    // formatUsdc('750000') = '0.08'. With the default data, monthly returns
    // (vaultValue − principal) also equals 750000, so the value can appear
    // in more than one panel — assert at least one occurrence.
    await waitFor(() => {
      expect(screen.getAllByText('0.08').length).toBeGreaterThan(0);
    });
  });

  it('renders apyPercent as percentage after data loads', async () => {
    setup();
    // APY aparece no badge do gráfico ("Annual yield: 7.50%") e no MoneyPanel
    // ("~7.50% a.a.") — assert ao menos uma ocorrência.
    await waitFor(() => {
      expect(screen.getAllByText(/7\.50%/).length).toBeGreaterThan(0);
    });
  });

  it('renders bill vendor name after data loads', async () => {
    setup();
    await waitFor(() => {
      // vendor appears in both the subscriptions grid and the virtual-card list
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
    });
  });

  it('renders monthly returns = vaultValue − principal via formatUsdc', async () => {
    mockGetDashboard.mockResolvedValue({
      vaultValue: '20000000',
      principal: '10000000',
      spendable: '5000000',
      apyPercent: '7.50',
    });
    mockListBills.mockResolvedValue([]);
    render(<DashboardPage />);
    // 20000000 − 10000000 = 10000000 → formatUsdc('10000000') = '1.00'
    // Appears in the "Monthly returns" stat card and the bar legend total.
    await waitFor(() => {
      expect(screen.getAllByText('1.00').length).toBeGreaterThan(0);
    });
  });

  it('renders committed = BigInt sum of bill monthlyCost via formatUsdc', async () => {
    mockGetDashboard.mockResolvedValue(DASHBOARD_DATA);
    mockListBills.mockResolvedValue([
      { id: 'b1', vendor: 'OpenAI', monthlyCost: '2000000', type: 'software', status: 'active' },
      { id: 'b2', vendor: 'Notion', monthlyCost: '3000000', type: 'software', status: 'active' },
    ]);
    render(<DashboardPage />);
    // committed = 2000000 + 3000000 = 5000000 → formatUsdc('5000000') = '0.50'
    await waitFor(() => {
      expect(screen.getByText('0.50')).toBeInTheDocument();
    });
  });

  it('shows error state with the localized message when getDashboard rejects', async () => {
    mockGetDashboard.mockRejectedValue(new Error('Server error'));
    mockListBills.mockResolvedValue([]);
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(T_ERROR)).toBeInTheDocument();
    });
  });

  it('mostra o MoneyPanel com o saldo da carteira', async () => {
    setup();
    // formatUsdc('1200000000') = '120.00'
    await waitFor(() => expect(screen.getByText('$120.00')).toBeInTheDocument());
  });

  it('clicar Aportar abre o MoveDrawer em modo deposit', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: /aportar/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /aportar/i }));
    expect(screen.getByTestId('move-drawer')).toHaveTextContent('drawer:deposit');
  });
});
