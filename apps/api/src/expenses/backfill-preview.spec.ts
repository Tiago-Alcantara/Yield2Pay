/**
 * Módulo: backfill-preview
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: A simulação mostra a chave e a flag, e recusa gravar ou sair da máquina.
 * Sequência: aluguel repetido entra como fixo; --apply e host remoto são recusados.
 */
import {
  assertLocalDatabaseUrl,
  assertSimulationOnly,
  previewHouseholdBackfill,
} from './backfill-preview';

const rent = (
  id: string,
  spentOn: string,
): Parameters<typeof previewHouseholdBackfill>[0][number] => ({
  id,
  merchant: 'Aluguel',
  spentOn,
  amountCents: 250000,
  category: 'housing',
  fixed: false,
  merchantKey: '',
  sharedMerchantKey: '',
});

describe('previewHouseholdBackfill', () => {
  it('preenche a chave e marca o aluguel que se repete', () => {
    const changes = previewHouseholdBackfill([
      rent('a', '2026-09-05'),
      rent('b', '2026-10-05'),
      {
        id: 'c',
        merchant: 'Padaria Estrela',
        spentOn: '2026-10-02',
        amountCents: 1800,
        category: 'groceries',
        fixed: false,
        merchantKey: '',
        sharedMerchantKey: '',
      },
    ]);
    const byId = Object.fromEntries(changes.map((row) => [row.id, row]));
    expect(byId.a).toMatchObject({
      merchantKey: 'aluguel',
      sharedMerchantKey: 'aluguel',
      fixed: true,
    });
    expect(byId.b?.fixed).toBe(true);
    expect(byId.c).toMatchObject({
      merchantKey: 'padaria estrela',
      sharedMerchantKey: 'padaria estrela',
    });
    expect(byId.c?.fixed).toBeUndefined();
  });

  it('não lista uma linha que já está calculada', () => {
    const changes = previewHouseholdBackfill([
      {
        id: 'a',
        merchant: 'Padaria',
        spentOn: '2026-10-02',
        amountCents: 100,
        category: 'groceries',
        fixed: false,
        merchantKey: 'padaria',
        sharedMerchantKey: 'padaria',
      },
    ]);
    expect(changes).toEqual([]);
  });
});

describe('limites da simulação', () => {
  it('recusa --apply', () => {
    expect(() => assertSimulationOnly(['--apply'])).toThrow('não grava');
    expect(() => assertSimulationOnly(['--apply=true'])).toThrow('não grava');
    expect(() => assertSimulationOnly([])).not.toThrow();
  });

  it('só aceita banco local', () => {
    expect(() =>
      assertLocalDatabaseUrl('postgresql://yield2pay:yield2pay@127.0.0.1:5432/yield2pay'),
    ).not.toThrow();
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@localhost:5432/yield2pay')).not.toThrow();
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@[::1]:5432/yield2pay')).not.toThrow();
    expect(() =>
      assertLocalDatabaseUrl('postgresql://u:p@db.example.com:5432/yield2pay'),
    ).toThrow('não é local');
  });
});
