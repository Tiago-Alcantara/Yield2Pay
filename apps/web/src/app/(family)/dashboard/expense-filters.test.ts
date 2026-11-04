/**
 * Módulo: expense-filters
 * Criado em: 2026-10-21
 * Última atualização: 2026-10-22
 * Intuito: Os filtros e os números do painel respeitam categoria, período e o que entra na soma.
 * Sequência: matches a merchant without accents; counts a custom range across months; rejects a minimum above the maximum and a negative amount; opens the current month even when a later month has expenses; shortens a million-real total so it fits the ring.
 */
import { describe, expect, it } from 'vitest';
import type { ExpenseView } from '@yield2pay/shared';
import { filterChips, foldSearch, matchesExpense, moneyFilterError, rowsNoun, type ExpenseFilters } from './FilterBar';
import { brlK, openingMonth } from './painel-format';

const row = (partial: Partial<ExpenseView>): ExpenseView => ({
  id: 'e1',
  date: '2026-09-02',
  merchant: 'Bom Preço',
  kind: 'expense',
  category: 'groceries',
  fixed: false,
  amountCents: 1000,
  excludedFromTotals: false,
  addedBy: { displayName: 'Ana', initials: 'A' },
  ...partial,
});

const filters = (partial: Partial<ExpenseFilters> = {}): ExpenseFilters => ({
  mode: 'mes',
  from: '',
  to: '',
  cats: [],
  tipo: 'todos',
  kind: 'todos',
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

  describe('filtro de tipo', () => {
    const spending = row({});
    const income = row({ id: 'e2', kind: 'income', category: null, merchant: 'Salário' });

    it('Todos mostra os dois; Gastos e Entradas mostram só o seu', () => {
      expect(matchesExpense(spending, filters(), '2026-09')).toBe(true);
      expect(matchesExpense(income, filters(), '2026-09')).toBe(true);

      expect(matchesExpense(spending, filters({ kind: 'expense' }), '2026-09')).toBe(true);
      expect(matchesExpense(income, filters({ kind: 'expense' }), '2026-09')).toBe(false);

      expect(matchesExpense(spending, filters({ kind: 'income' }), '2026-09')).toBe(false);
      expect(matchesExpense(income, filters({ kind: 'income' }), '2026-09')).toBe(true);
    });

    it('a linha sem o campo, da API antiga, conta como gasto', () => {
      const legacy = { ...spending, kind: undefined } as unknown as ExpenseView;
      expect(matchesExpense(legacy, filters({ kind: 'expense' }), '2026-09')).toBe(true);
      expect(matchesExpense(legacy, filters({ kind: 'income' }), '2026-09')).toBe(false);
    });

    it('a entrada não tem categoria nem é fixa ou variável', () => {
      expect(matchesExpense(income, filters({ cats: ['groceries'] }), '2026-09')).toBe(false);
      expect(matchesExpense(income, filters({ tipo: 'fixo' }), '2026-09')).toBe(false);
      expect(matchesExpense(income, filters({ tipo: 'var' }), '2026-09')).toBe(false);
    });

    it('os outros filtros continuam valendo para a entrada', () => {
      expect(matchesExpense(income, filters({ kind: 'income', q: 'salario' }), '2026-09')).toBe(true);
      expect(matchesExpense(income, filters({ kind: 'income', q: 'mercado' }), '2026-09')).toBe(false);
      expect(matchesExpense(income, filters({ kind: 'income', min: '11' }), '2026-09')).toBe(false);
      expect(matchesExpense(income, filters({ kind: 'income' }), '2026-10')).toBe(false);
    });

    it('vira chip e o chip limpa só o tipo', () => {
      expect(filterChips(filters({ kind: 'income' }))).toEqual([
        { key: 'kind', label: 'Só entradas', clear: { kind: 'todos' } },
      ]);
      expect(filterChips(filters({ kind: 'expense' }))).toEqual([
        { key: 'kind', label: 'Só gastos', clear: { kind: 'todos' } },
      ]);
      expect(filterChips(filters())).toEqual([]);
    });

    it('chama as linhas pelo que elas são', () => {
      expect(rowsNoun([spending]).many).toBe('gastos');
      expect(rowsNoun([]).many).toBe('gastos');
      expect(rowsNoun([income]).one).toBe('entrada');
      expect(rowsNoun([spending, income]).many).toBe('lançamentos');
    });
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
