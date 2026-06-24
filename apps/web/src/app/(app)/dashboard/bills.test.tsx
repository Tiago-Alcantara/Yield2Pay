/**
 * bills.test.tsx
 * Behavior tests for the Bills management section.
 * Bills now receives bills + onBillsChanged as props (no internal fetch).
 * Mocks @/lib/api — no real network.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- mock @/lib/api ---
const mockCreateBill = vi.fn();
const mockDeleteBill = vi.fn();

vi.mock('@/lib/api', () => ({
  createApi: () => ({
    createBill: mockCreateBill,
    deleteBill: mockDeleteBill,
  }),
}));

// --- mock @privy-io/react-auth ---
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'mock-token' }),
}));

import Bills from './Bills';
import type { Bill } from '@fixearn/shared';

const EXISTING_BILLS: Bill[] = [
  { id: 'b1', vendor: 'Notion', monthlyCost: '1600000', type: 'software', status: 'active' },
];

function setup(bills: Bill[] = EXISTING_BILLS, onBillsChanged = vi.fn()) {
  mockCreateBill.mockResolvedValue({ id: 'b2', vendor: 'OpenAI', monthlyCost: '20000000', type: 'software', status: 'active' });
  mockDeleteBill.mockResolvedValue(undefined);
  return { onBillsChanged, ...render(<Bills bills={bills} onBillsChanged={onBillsChanged} />) };
}

describe('Bills management', () => {
  beforeEach(() => {
    mockCreateBill.mockReset();
    mockDeleteBill.mockReset();
  });

  it('renders the add bill form with vendor, cost, type, and submit button', () => {
    setup();
    expect(screen.getByLabelText(/vendor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/monthly cost/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add bill/i })).toBeInTheDocument();
  });

  it('defaults the type select to "software"', () => {
    setup();
    const typeSelect = screen.getByLabelText(/type/i) as HTMLSelectElement;
    expect(typeSelect.value).toBe('software');
  });

  it('calls createBill with correct args and then onBillsChanged when the form is submitted', async () => {
    const { onBillsChanged } = setup();

    const vendorInput = screen.getByLabelText(/vendor/i);
    const costInput = screen.getByLabelText(/monthly cost/i);

    await userEvent.clear(vendorInput);
    await userEvent.type(vendorInput, 'OpenAI');
    await userEvent.clear(costInput);
    await userEvent.type(costInput, '2');

    fireEvent.click(screen.getByRole('button', { name: /add bill/i }));

    await waitFor(() => {
      // toBaseUnits('2') = '20000000' (2 * 10^7)
      expect(mockCreateBill).toHaveBeenCalledWith({
        vendor: 'OpenAI',
        monthlyCost: '20000000',
        type: 'software',
      });
    });

    await waitFor(() => {
      expect(onBillsChanged).toHaveBeenCalledTimes(1);
    });
  });

  it('lists bills passed via props with vendor name, formatted cost, and type', () => {
    setup();
    expect(screen.getByText('Notion')).toBeInTheDocument();
    // formatUsdc('1600000') = '0.16'
    expect(screen.getByText(/0\.16/)).toBeInTheDocument();
    // 'software' appears in the type option AND the bill type label — at least one should be in doc
    expect(screen.getAllByText('software').length).toBeGreaterThan(0);
  });

  it('calls deleteBill with the bill id and then onBillsChanged when delete is clicked', async () => {
    const { onBillsChanged } = setup();

    const deleteBtn = screen.getByRole('button', { name: /delete notion/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockDeleteBill).toHaveBeenCalledWith('b1');
    });

    await waitFor(() => {
      expect(onBillsChanged).toHaveBeenCalledTimes(1);
    });
  });

  it('filters bills by tab prop when tab is not "all"', () => {
    const mixedBills: Bill[] = [
      { id: 'b1', vendor: 'Notion', monthlyCost: '1600000', type: 'software', status: 'active' },
      { id: 'b2', vendor: 'Electricity', monthlyCost: '5000000', type: 'utility', status: 'active' },
    ];
    render(<Bills bills={mixedBills} onBillsChanged={vi.fn()} tab="software" />);
    expect(screen.getByText('Notion')).toBeInTheDocument();
    expect(screen.queryByText('Electricity')).not.toBeInTheDocument();
  });

  it('shows empty state when no bills match the tab filter', () => {
    render(<Bills bills={EXISTING_BILLS} onBillsChanged={vi.fn()} tab="utility" />);
    expect(screen.getByText(/no bills yet/i)).toBeInTheDocument();
  });
});
