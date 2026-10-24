/**
 * Módulo: expense-filters
 * Criado em: 2026-10-21
 * Última atualização: 2026-10-22
 * Intuito: Os filtros e os números do painel respeitam categoria, período e o que entra na soma.
 * Sequência: matches a merchant without accents; counts a custom range across months; rejects a minimum above the maximum and a negative amount; opens the current month even when a later month has expenses; shortens a million-real total so it fits the ring.
 */
import { describe, expect, it } from 'vitest';
import type { ExpenseView } from '@yield2pay/shared';
import { foldSearch, matchesExpense, moneyFilterError, type ExpenseFilters } from './FilterBar';
import { brlK, openingMonth } from './painel-format';

const row = (partial: Partial<ExpenseView>): ExpenseView => ({
  id: 'e1',
  date: '2026-09-02',
  merchant: 'Bom Preço',
  category: 'groceries',
  fixed: false,
  amountCents: 1000,
  addedBy: { displayName: 'Ana', initials: 'A' },
  ...partial,
});

const filters = (partial: Partial<ExpenseFilters> = {}): ExpenseFilters => ({
  mode: 'mes',
  from: '',
  to: '',
  cats: [],
  tipo: 'todos',
  min: '',
  max: '',
  q: '',
  ...partial,
});

describe('expense filters', () => {
  it('matches a merchant without accents', () => {
    expect(foldSearch('Bom Preço')).toBe('bom preco');
    expect(matchesExpense(row({}), filters({ q: 'bom preco' }), '2026-09')).toBe(true);
  });

  it('counts a custom range across months', () => {
    const august = row({ date: '2026-08-02' });
    const november = row({ id: 'e2', date: '2026-11-02' });
    const custom = filters({ mode: 'custom', from: '2026-08-01', to: '2026-11-30' });
    expect(matchesExpense(august, custom)).toBe(true);
    expect(matchesExpense(november, custom)).toBe(true);
    expect(matchesExpense(august, filters(), '2026-10')).toBe(false);
  });

  it('rejects a minimum above the maximum and a negative amount', () => {
    expect(moneyFilterError('80', '10')).toBe('O mínimo está maior que o máximo.');
    expect(moneyFilterError('-50', '')).toBe('O valor não pode ser negativo.');
    expect(moneyFilterError('10', '80')).toBe('');
  });
});

describe('painel numbers', () => {
  it('opens the current month even when a later month has expenses', () => {
    expect(openingMonth(['2026-08', '2026-09', '2026-11'], '2026-10-21')).toBe('2026-10');
    expect(openingMonth(['2026-08', '2026-09'], '2026-10-21')).toBe('2026-10');
  });

  it('shortens a million-real total so it fits the ring', () => {
    expect(brlK(10_004_300)).toBe('R$ 10 mi');
  });
});
