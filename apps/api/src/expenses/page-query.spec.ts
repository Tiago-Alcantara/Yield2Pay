/**
 * Módulo: page-query
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: A página recusa o que não é inteiro decimal.
 * Sequência: notação científica, hexadecimal, espaço e array falham.
 */
import { ExpenseInvalidError } from './expense.errors';
import { parseExpensePage } from './page-query';

describe('parseExpensePage', () => {
  it('aceita inteiro decimal dentro do teto', () => {
    expect(parseExpensePage({ limit: '50', offset: '0' })).toEqual({
      limit: 50,
      offset: 0,
    });
    expect(parseExpensePage({})).toEqual({ limit: 100, offset: 0 });
  });

  it.each(['1e20', '0x10', '1e3', ' 50 ', ['50']])('recusa %j', (value) => {
    expect(() => parseExpensePage({ offset: value })).toThrow(
      ExpenseInvalidError,
    );
    expect(() => parseExpensePage({ limit: value })).toThrow(
      ExpenseInvalidError,
    );
  });

  it('recusa offset acima do teto', () => {
    expect(() => parseExpensePage({ offset: '1000001' })).toThrow(
      'offset is invalid',
    );
  });
});
