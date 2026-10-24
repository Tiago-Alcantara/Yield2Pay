/**
 * Módulo: parse-money
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: Texto de dinheiro vira unidades inteiras, e o BigInt continua serializável em JSON.
 * Sequência: returns a bigint for a valid positive integer string; throws for empty string; throws for undefined; throws for null; throws for non-numeric string; throws for decimal string; throws for zero; throws for negative-sign prefix; serializes BigInt as decimal string.
 */
import { BadRequestException } from '@nestjs/common';
import { parseBaseUnits } from './parse-money';

describe('parseBaseUnits', () => {
  it('returns a bigint for a valid positive integer string', () => {
    expect(parseBaseUnits('1000000')).toBe(1000000n);
    expect(parseBaseUnits('1')).toBe(1n);
    expect(parseBaseUnits('999999999999999999')).toBe(999999999999999999n);
  });

  it('throws for empty string', () => {
    expect(() => parseBaseUnits('')).toThrow(BadRequestException);
  });

  it('throws for undefined', () => {
    expect(() => parseBaseUnits(undefined)).toThrow(BadRequestException);
  });

  it('throws for null', () => {
    expect(() => parseBaseUnits(null)).toThrow(BadRequestException);
  });

  it('throws for non-numeric string', () => {
    expect(() => parseBaseUnits('abc')).toThrow(BadRequestException);
    expect(() => parseBaseUnits('1e5')).toThrow(BadRequestException);
    expect(() => parseBaseUnits('12abc')).toThrow(BadRequestException);
  });

  it('throws for decimal string', () => {
    expect(() => parseBaseUnits('1.5')).toThrow(BadRequestException);
    expect(() => parseBaseUnits('100.00')).toThrow(BadRequestException);
  });

  it('throws for zero', () => {
    expect(() => parseBaseUnits('0')).toThrow(BadRequestException);
  });

  it('throws for negative-sign prefix', () => {
    expect(() => parseBaseUnits('-1')).toThrow(BadRequestException);
    expect(() => parseBaseUnits('-100')).toThrow(BadRequestException);
  });
});

describe('BigInt JSON serialization shim', () => {
  it('serializes BigInt as decimal string', () => {
    expect(JSON.stringify({ x: 1n })).toBe('{"x":"1"}');
    expect(JSON.stringify({ amount: 1000000n })).toBe('{"amount":"1000000"}');
  });
});
