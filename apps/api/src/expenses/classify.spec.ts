/**
 * Módulo: classify
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: O texto do extrato cai na categoria certa e o gasto repetido é marcado como fixo.
 * Sequência: maps grocery keywords and falls back to shopping; maps Brazilian merchants that the short keyword list used to miss; maps IPVA, a power bill, and a fee away from shopping; marks rent and a repeating subscription as fixed, and leaves a one-off grocery; treats a repeat within 5 percent as fixed.
 */
import {
  classifyMerchant,
  idsToMarkFixed,
  isFixedRepeat,
  merchantKey,
  sharedMerchantKey,
} from './classify';

describe('classify', () => {
  it('maps grocery keywords and falls back to shopping', () => {
    expect(classifyMerchant('Supermercado Dia')).toBe('groceries');
    expect(classifyMerchant('PIX enviado')).toBe('shopping');
  });

  it('maps Brazilian merchants that the short keyword list used to miss', () => {
    expect(classifyMerchant('Padaria Estrela')).toBe('groceries');
    expect(classifyMerchant('ENEL SP')).toBe('housing');
    expect(classifyMerchant('Vivo Celular')).toBe('subscriptions');
    expect(classifyMerchant('iFood *Burger')).toBe('restaurant');
    expect(classifyMerchant('Drogaria Sao Paulo')).toBe('health');
    expect(classifyMerchant('99 POP')).toBe('transport');
    expect(classifyMerchant('Farmácia Raia')).toBe('health');
  });

  it('maps IPVA, a power bill, and a fee away from shopping', () => {
    expect(classifyMerchant('IPVA 2026')).toBe('transport');
    expect(classifyMerchant('CONTA DE LUZ')).toBe('housing');
    expect(classifyMerchant('TARIFA PACOTE SERVICOS')).toBe('housing');
    expect(classifyMerchant('Supermercado Bom Preço')).toBe('groceries');
    expect(classifyMerchant('PÃO DE AÇÚCAR')).toBe('groceries');
    expect(classifyMerchant('AÇOUGUE CONCEIÇÃO')).toBe('groceries');
  });

  it('marks rent and a repeating subscription as fixed, and leaves a one-off grocery', () => {
    const ids = idsToMarkFixed([
      {
        id: 'a',
        merchant: 'Aluguel',
        spentOn: '2026-09-05',
        amountCents: 250000,
        category: 'housing',
      },
      {
        id: 'b',
        merchant: 'Aluguel',
        spentOn: '2026-10-05',
        amountCents: 250000,
        category: 'housing',
      },
      {
        id: 'c',
        merchant: 'NETFLIX',
        spentOn: '2026-09-02',
        amountCents: 5590,
        category: 'subscriptions',
      },
      {
        id: 'd',
        merchant: 'netflix',
        spentOn: '2026-10-02',
        amountCents: 3990,
        category: 'subscriptions',
      },
      {
        id: 'a2',
        merchant: 'ALUGUEL SETEMBRO',
        spentOn: '2026-09-05',
        amountCents: 250000,
        category: 'housing',
      },
      {
        id: 'c2',
        merchant: 'NETFLIX.COM',
        spentOn: '2026-09-02',
        amountCents: 5590,
        category: 'subscriptions',
      },
      {
        id: 'e',
        merchant: 'Padaria',
        spentOn: '2026-09-01',
        amountCents: 1800,
        category: 'groceries',
      },
      {
        id: 'f',
        merchant: 'Padaria',
        spentOn: '2026-10-01',
        amountCents: 9000,
        category: 'groceries',
      },
    ]);
    expect(ids.sort()).toEqual(['a', 'a2', 'b', 'c', 'c2', 'd']);
  });

  it('treats a repeat within 5 percent as fixed', () => {
    expect(isFixedRepeat(10000, 10400)).toBe(true);
    expect(isFixedRepeat(10000, 10600)).toBe(false);
  });

  it('picks the shortest stored prefix without scanning every pair twice', () => {
    const keys = ['aluguel', 'netflix', 'netflix com', 'padaria estrela'];
    expect(sharedMerchantKey('netflix com', keys)).toBe('netflix');
    expect(sharedMerchantKey('aluguel setembro', keys)).toBe('aluguel');
    expect(sharedMerchantKey(merchantKey('NETFLIX.COM'), keys)).toBe('netflix');
    expect(sharedMerchantKey('padaria', keys)).toBe('padaria');
    const brute = (key: string) =>
      keys
        .filter(
          (other) =>
            other.length >= 4 &&
            other.length < key.length &&
            key.startsWith(`${other} `),
        )
        .sort((left, right) => left.length - right.length)[0] ?? key;
    for (const key of [...keys, 'netflix com br', 'ab cd efgh']) {
      expect(sharedMerchantKey(key, keys)).toBe(brute(key));
    }
  });
});
