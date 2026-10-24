/**
 * Módulo: i18n
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: O dicionário devolve a frase do idioma pedido.
 * Sequência: has matching keys in en and pt; translates a known key.
 */
import { dict } from './i18n';

describe('i18n', () => {
  it('has matching keys in en and pt', () => {
    expect(Object.keys(dict.en).sort()).toEqual(Object.keys(dict.pt).sort());
  });

  it('translates a known key', () => {
    expect(dict.pt.getStarted).toBe('Começar');
    expect(dict.en.getStarted).toBe('Get started');
  });
});
