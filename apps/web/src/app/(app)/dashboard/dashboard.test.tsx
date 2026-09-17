/**
 * dashboard.test.tsx
 * Behavior tests for the Dashboard page.
 * Mocks @/lib/api — no real network.
 * Default UI language is PT.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetDashboard = vi.fn();
const mockListBills = vi.fn();
const mockGetWalletBalance = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    createApi: () => ({
      getDashboard: mockGetDashboard,
      listBills: mockListBills,
      getWalletBalance: mockGetWalletBalance,
      getAccountChain: vi.fn().mockResolvedValue({
        selectedChain: 'stellar',
        unlockedChains: ['stellar'],
      }),
      setAccountChain: vi.fn(),
    }),
  };
});

vi.mock('@/components/MoveDrawer', () => ({
  MoveDrawer: ({ mode, onSuccess }: { mode: string; onSuccess: () => void }) => (
    <div data-testid="move-drawer">
      drawer:{mode}
      <button onClick={onSuccess}>drawer-success</button>
    </div>
  ),
}));

vi.mock('@/components/ChainUnlockPanel', () => ({
  ChainUnlockPanel: () => <div data-testid="chain-unlock-panel" />,
}));

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'mock-token', logout: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard',
}));

import DashboardPage from './page';

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
    mockGetWalletBalance.mockResolvedValue({ balance: '0', spendable: '0' });
  });

  it('shows loading state initially', () => {
    mockGetDashboard.mockReturnValue(new Promise(() => {}));
    mockListBills.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('renders vaultValue via formatUsdc after data loads', async () => {
    setup();
    // MoneyPanel vault shows `$` + formatUsdc('10750000') = `$1.08`
    await waitFor(() => {
      expect(screen.getByText('$1.08')).toBeInTheDocument();
    });
  });

  it('renders spendable via formatUsdc after data loads', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getAllByText('0.08').length).toBeGreaterThan(0);
    });
  });

  it('renders apyPercent as percentage after data loads', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getAllByText(/7\.50%/).length).toBeGreaterThan(0);
    });
  });

  it('renders bill vendor name after data loads', async () => {
    setup();
    await waitFor(() => {
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
    await waitFor(() => {
      expect(screen.getByText('0.50')).toBeInTheDocument();
    });
  });

  it('shows error state with the rejection message when getDashboard rejects', async () => {
    mockGetDashboard.mockRejectedValue(new Error('Server error'));
    mockListBills.mockResolvedValue([]);
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('mostra o MoneyPanel com o saldo da carteira', async () => {
    setup();
    await waitFor(() => expect(screen.getByText('$120.00')).toBeInTheDocument());
  });

  it('clicar Aportar abre o MoveDrawer em modo deposit', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: /aportar/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /aportar/i }));
    expect(screen.getByTestId('move-drawer')).toHaveTextContent('drawer:deposit');
  });
});
