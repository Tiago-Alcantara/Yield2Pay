/**
 * Módulo: fixed-flags
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: A flag fixa e a chave compartilhada saem na escrita, só para o grupo afetado.
 * Sequência: marks a second month of rent and leaves an unrelated grocery untouched.
 */
import {
  clearLegacyKeyCache,
  expenseGroupWhere,
  loadLegacyFixedIds,
  planExpenseWrite,
  rowsInMerchantGroup,
} from './fixed-flags';

describe('planExpenseWrite', () => {
  it('marks a second month of rent and leaves an unrelated grocery untouched', () => {
    const plan = planExpenseWrite(
      [
        {
          id: 'rent',
          merchant: 'Aluguel',
          spentOn: '2026-09-05',
          amountCents: 250000,
          category: 'housing',
          fixed: false,
          sharedMerchantKey: 'aluguel',
        },
        {
          id: 'market',
          merchant: 'Padaria Estrela',
          spentOn: '2026-09-02',
          amountCents: 1800,
          category: 'groceries',
          fixed: false,
          sharedMerchantKey: 'padaria estrela',
        },
      ],
      [
        {
          merchant: 'Aluguel',
          spentOn: '2026-10-05',
          amountCents: 250000,
          category: 'housing',
        },
      ],
    );
    expect(plan.inserts[0]).toMatchObject({
      merchantKey: 'aluguel',
      sharedMerchantKey: 'aluguel',
      fixed: true,
    });
    expect(plan.markFixed).toEqual(['rent']);
    expect(plan.unmarkFixed).toEqual([]);
    expect(plan.sharedKeyUpdates.has('padaria estrela')).toBe(false);
    expect([...(plan.sharedKeyUpdates.get('aluguel') ?? [])]).not.toContain(
      'market',
    );
  });

  it('desmarca o grupo que deixou de se repetir e preserva o fixo manual', () => {
    const plan = planExpenseWrite(
      [
        {
          id: 'rent',
          merchant: 'Aluguel',
          spentOn: '2026-10-05',
          amountCents: 250000,
          category: 'housing',
          fixed: true,
          fixedManual: false,
          sharedMerchantKey: 'aluguel',
        },
        {
          id: 'hand',
          merchant: 'Aluguel',
          spentOn: '2026-10-06',
          amountCents: 250000,
          category: 'housing',
          fixed: true,
          fixedManual: true,
          sharedMerchantKey: 'aluguel',
        },
      ],
      [],
      true,
    );
    expect(plan.unmarkFixed).toEqual(['rent']);
    expect(plan.unmarkFixed).not.toContain('hand');
    expect(plan.markFixed).not.toContain('hand');
  });

  it('não remarra um fixo que a pessoa desmarcou à mão', () => {
    const plan = planExpenseWrite(
      [
        {
          id: 'hand',
          merchant: 'Netflix',
          spentOn: '2026-09-02',
          amountCents: 5590,
          category: 'subscriptions',
          fixed: false,
          fixedManual: true,
          merchantKey: 'netflix',
          sharedMerchantKey: 'netflix',
        },
      ],
      [
        {
          merchant: 'Netflix',
          spentOn: '2026-10-02',
          amountCents: 5590,
          category: 'subscriptions',
        },
      ],
    );
    expect(plan.inserts[0]?.fixed).toBe(true);
    expect(plan.markFixed).not.toContain('hand');
  });

  it('grava a chave da linha antiga e marca a Netflix nova como fixa', () => {
    const plan = planExpenseWrite(
      [
        {
          id: 'old',
          merchant: 'Netflix',
          spentOn: '2026-09-02',
          amountCents: 5590,
          category: 'subscriptions',
          fixed: false,
          merchantKey: '',
          sharedMerchantKey: '',
        },
      ],
      [
        {
          merchant: 'Netflix',
          spentOn: '2026-10-02',
          amountCents: 5590,
          category: 'subscriptions',
        },
      ],
    );
    expect(plan.inserts[0]).toMatchObject({
      merchantKey: 'netflix',
      sharedMerchantKey: 'netflix',
      fixed: true,
    });
    expect(plan.markFixed).toEqual(['old']);
    expect(plan.keyUpdates).toEqual([
      { id: 'old', merchantKey: 'netflix', sharedMerchantKey: 'netflix' },
    ]);
  });

  it('junta Netflix nova com o prefixo antigo netflix premium', () => {
    const old = {
      id: 'old',
      merchant: 'Netflix Premium',
      spentOn: '2026-09-02',
      amountCents: 5590,
      category: 'subscriptions',
      fixed: false,
      merchantKey: 'netflix premium',
      sharedMerchantKey: 'netflix premium',
    };
    expect(rowsInMerchantGroup([old], ['Netflix'])).toEqual([old]);
    const plan = planExpenseWrite(
      [old],
      [
        {
          merchant: 'Netflix',
          spentOn: '2026-10-02',
          amountCents: 5590,
          category: 'subscriptions',
        },
      ],
    );
    expect(plan.inserts[0]?.fixed).toBe(true);
    expect(plan.inserts[0]?.sharedMerchantKey).toBe('netflix');
    expect(plan.markFixed).toEqual(['old']);
  });

  it('o filtro do grupo inclui chave vazia e prefixo', () => {
    const where = expenseGroupWhere('h1', ['Netflix']);
    const encoded = JSON.stringify(where);
    expect(encoded).toContain('"merchantKey":""');
    expect(encoded).toContain('netflix');
    expect(encoded).toContain('netflix ');
  });
});

describe('loadLegacyFixedIds', () => {
  beforeEach(() => {
    clearLegacyKeyCache();
  });

  it('não consulta de novo a casa que já não tem chave vazia', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const findMany = vi.fn();
    const db = { expense: { findFirst, findMany } };
    await expect(loadLegacyFixedIds(db as never, 'casa-a')).resolves.toBeNull();
    await expect(loadLegacyFixedIds(db as never, 'casa-a')).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findMany).not.toHaveBeenCalled();
    await loadLegacyFixedIds(db as never, 'casa-b');
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('continua consultando enquanto ainda existe chave vazia', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'probe' });
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { expense: { findFirst, findMany } };
    await loadLegacyFixedIds(db as never, 'casa-a');
    await loadLegacyFixedIds(db as never, 'casa-a');
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
