/**
 * Módulo: fixed-flags
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: A flag fixa e a chave compartilhada saem na escrita, só para o grupo afetado.
 * Sequência: marks a second month of rent and leaves an unrelated grocery untouched.
 */
import { planExpenseWrite } from './fixed-flags';

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
});
