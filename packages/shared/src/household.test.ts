/**
 * Módulo: household
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: Os tipos da casa aceitam um gasto com quem lançou e uma conta família.
 * Sequência: accepts an expense row with who added it.
 */
import { describe, it, expect } from 'vitest';
import type { ExpenseView, AccountView } from './household';

describe('household types', () => {
  it('accepts an expense row with who added it', () => {
    const row: ExpenseView = {
      id: 'e1',
      date: '2026-10-12',
      merchant: 'Mercado',
      category: 'groceries',
      fixed: false,
      amountCents: 1250,
      addedBy: { displayName: 'Ana', initials: 'A' },
    };
    const account: AccountView = {
      displayName: 'Ana',
      fullName: 'Ana Lima',
      email: 'ana@example.com',
      initials: 'AL',
      accountType: 'family',
      household: null,
    };
    expect(row.amountCents).toBe(1250);
    expect(account.accountType).toBe('family');
  });
});
