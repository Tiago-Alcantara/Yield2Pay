/**
 * ServiceCatalog.test.tsx
 * Behavior tests for the backend-wired service catalog.
 * Mocks @/lib/api, @privy-io/react-auth, next/navigation — no real network.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockCreateBill = vi.fn();
const mockDeleteBill = vi.fn();
const mockPush = vi.fn();

vi.mock('@/lib/api', () => ({
  createApi: () => ({ createBill: mockCreateBill, deleteBill: mockDeleteBill }),
}));
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'mock-token' }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => '/dashboard',
}));

import ServiceCatalog from './ServiceCatalog';
import type { Bill } from '@yield2pay/shared';

// 100.00 USDC of headroom — affords any single catalog service.
const RICH = '1000000000';

function setup(props: Partial<React.ComponentProps<typeof ServiceCatalog>> = {}) {
  mockCreateBill.mockResolvedValue({ id: 'new', vendor: 'x', monthlyCost: '0', type: 'software', status: 'active' });
  mockDeleteBill.mockResolvedValue(undefined);
  const onBillsChanged = vi.fn();
  const view = render(
    <ServiceCatalog
      bills={props.bills ?? []}
      spendable={props.spendable ?? RICH}
      category={props.category ?? 'all'}
      onBillsChanged={props.onBillsChanged ?? onBillsChanged}
    />,
  );
  return { onBillsChanged, ...view };
}

describe('ServiceCatalog', () => {
  beforeEach(() => {
    mockCreateBill.mockReset();
    mockDeleteBill.mockReset();
    mockPush.mockReset();
  });

  it('renders catalog service cards', () => {
    setup();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Notion')).toBeInTheDocument();
    expect(screen.getByText('Linear')).toBeInTheDocument();
  });

  it('activating an affordable service calls createBill then onBillsChanged', async () => {
    const { onBillsChanged } = setup({ spendable: RICH, bills: [] });
    fireEvent.click(screen.getByRole('switch', { name: 'Slack' }));
    await waitFor(() => {
      expect(mockCreateBill).toHaveBeenCalledWith({
        vendor: 'Slack',
        monthlyCost: '95000000', // toBaseUnits('9.50')
        type: 'software',
      });
    });
    await waitFor(() => expect(onBillsChanged).toHaveBeenCalledTimes(1));
  });

  it('an active service shows On and deactivating calls deleteBill', async () => {
    const bills: Bill[] = [
      { id: 'b1', vendor: 'OpenAI', monthlyCost: '499000000', type: 'software', status: 'active' },
    ];
    const { onBillsChanged } = setup({ bills, spendable: RICH });
    const sw = screen.getByRole('switch', { name: 'OpenAI' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(sw);
    await waitFor(() => expect(mockDeleteBill).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(onBillsChanged).toHaveBeenCalledTimes(1));
  });

  it('an unaffordable inactive service is disabled and offers Increase deposit', () => {
    setup({ spendable: '0', bills: [] });
    expect(screen.getByRole('switch', { name: 'OpenAI' })).toBeDisabled();
    expect(screen.getAllByText(/increase deposit/i).length).toBeGreaterThan(0);
  });

  it('routes to /deposit when Increase deposit is clicked', () => {
    setup({ spendable: '0', bills: [] });
    fireEvent.click(screen.getAllByRole('button', { name: /increase deposit/i })[0]);
    expect(mockPush).toHaveBeenCalledWith('/deposit');
  });

  it('filters cards by category', () => {
    setup({ category: 'ai' });
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.queryByText('Notion')).not.toBeInTheDocument();
  });

  it('lists active bills (including custom vendors outside the catalog)', () => {
    const bills: Bill[] = [
      { id: 'b9', vendor: 'Electricity', monthlyCost: '5000000', type: 'utility', status: 'active' },
    ];
    setup({ bills, spendable: RICH });
    expect(screen.getByText('Electricity')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove electricity/i })).toBeInTheDocument();
  });
});
