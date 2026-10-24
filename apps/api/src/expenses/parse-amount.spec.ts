/**
 * Módulo: parse-amount
 * Criado em: 2026-10-19
 * Última atualização: 2026-10-22
 * Intuito: Valores brasileiros e com ponto viram centavos.
 * Sequência: parses Brazilian and dot amounts to centavos.
 */
import { parseAmountToCents } from './parse-amount';

describe('parse-amount', () => {
  it('parses Brazilian and dot amounts to centavos', () => {
    expect(parseAmountToCents('R$ 1.234,56')).toBe(123456);
    expect(parseAmountToCents('1234.56')).toBe(123456);
    expect(parseAmountToCents('-10.50')).toBe(1050);
  });
});
