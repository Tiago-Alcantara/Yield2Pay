/**
 * dashboard.test.tsx
 * Behavior tests for the Dashboard page.
 * Mocks @/lib/api — no real network.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- mock @/lib/api ---
const mockGetDashboard = vi.fn();
const mockListBills = vi.fn();

vi.mock('@/lib/api', () => ({
  createApi: () => ({
    getDashboard: mockGetDashboard,
    listBills: mockListBills,
  }),
}));

// --- mock @privy-io/react-auth (needed for createApi(getAccessToken)) ---
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'mock-token' }),
}));

// --- mock next/navigation ---
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard',
}));

import DashboardPage from './page';

// Localized strings used in assertions (mirror the page's EN dictionary).
const T_ERROR = 'Error loading dashboard.';

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
  return render(<DashboardPage />);
}

describe('Dashboard page', () => {
  beforeEach(() => {
    mockGetDashboard.mockReset();
    mockListBills.mockReset();
  });

  it('shows loading state initially', () => {
    mockGetDashboard.mockReturnValue(new Promise(() => {})); // never resolves
    mockListBills.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders vaultValue via formatUsdc after data loads', async () => {
    setup();
    // formatUsdc('10750000') = '1.075'
    await waitFor(() => {
      expect(screen.getByText('1.075')).toBeInTheDocument();
    });
  });

  it('renders spendable via formatUsdc after data loads', async () => {
    setup();
    // formatUsdc('750000') = '0.075'. With the default data, monthly returns
    // (vaultValue − principal) also equals 750000, so the value can appear
    // in more than one panel — assert at least one occurrence.
    await waitFor(() => {
      expect(screen.getAllByText('0.075').length).toBeGreaterThan(0);
    });
  });

  it('renders apyPercent as percentage after data loads', async () => {
    setup();
    // APY now appears in the returns-chart badge ("Annual yield: 7.50%")
    await waitFor(() => {
      expect(screen.getByText(/7\.50%/)).toBeInTheDocument();
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
    // vaultValue 10750000 − principal 10000000 = 750000 → formatUsdc = '0.075'
    mockGetDashboard.mockResolvedValue({
      vaultValue: '20000000',
      principal: '10000000',
      spendable: '5000000',
      apyPercent: '7.50',
    });
    mockListBills.mockResolvedValue([]);
    render(<DashboardPage />);
    // 20000000 − 10000000 = 10000000 → formatUsdc('10000000') = '1'
    // Appears in the "Monthly returns" stat card and the bar legend total.
    await waitFor(() => {
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    });
  });

  it('renders committed = BigInt sum of bill monthlyCost via formatUsdc', async () => {
    mockGetDashboard.mockResolvedValue(DASHBOARD_DATA);
    mockListBills.mockResolvedValue([
      { id: 'b1', vendor: 'OpenAI', monthlyCost: '2000000', type: 'software', status: 'active' },
      { id: 'b2', vendor: 'Notion', monthlyCost: '3000000', type: 'software', status: 'active' },
    ]);
    render(<DashboardPage />);
    // committed = 2000000 + 3000000 = 5000000 → formatUsdc('5000000') = '0.5'
    await waitFor(() => {
      expect(screen.getByText('0.5')).toBeInTheDocument();
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
});
