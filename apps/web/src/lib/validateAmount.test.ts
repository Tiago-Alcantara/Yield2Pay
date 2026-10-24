/**
 * Módulo: validateAmount
 * Criado em: 2026-06-25
 * Última atualização: 2026-10-22
 * Intuito: O valor digitado é aceito só quando é um número positivo no formato certo.
 * Sequência: rejects empty input; rejects zero; rejects non-numeric input; rejects negative amounts; rejects more than 7 decimals; accepts a valid amount.
 */
import { describe, it, expect } from 'vitest';
import { validateAmount } from './validateAmount';

describe('validateAmount', () => {
  it('rejects empty input', () => {
    expect(validateAmount('')).toBe('Enter a positive amount');
  });

  it('rejects zero', () => {
    expect(validateAmount('0')).toBe('Enter a positive amount');
  });

  it('rejects non-numeric input', () => {
    expect(validateAmount('abc')).toBe('Enter a positive amount');
  });

  it('rejects negative amounts', () => {
    expect(validateAmount('-5')).toBe('Enter a positive amount');
  });

  it('rejects more than 7 decimals', () => {
    expect(validateAmount('1.12345678')).toBe('Max 7 decimal places');
  });

  it('accepts a valid amount', () => {
    expect(validateAmount('10.5')).toBeNull();
    expect(validateAmount('18400')).toBeNull();
  });
});
