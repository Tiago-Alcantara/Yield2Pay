/**
 * Módulo: errors
 * Criado em: 2026-06-25
 * Última atualização: 2026-10-22
 * Intuito: A mensagem mostrada ao usuário sai do corpo da API ou de um texto genérico.
 * Sequência: returns the message from an Error; stringifies non-Error values when no fallback is given; uses the fallback for non-Error values when one is given; still prefers the Error message over the fallback.
 */
import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('returns the message from an Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('stringifies non-Error values when no fallback is given', () => {
    expect(getErrorMessage('nope')).toBe('nope');
    expect(getErrorMessage(42)).toBe('42');
  });

  it('uses the fallback for non-Error values when one is given', () => {
    expect(getErrorMessage(null, 'Failed to add bill')).toBe('Failed to add bill');
    expect(getErrorMessage({}, 'Failed to delete bill')).toBe('Failed to delete bill');
  });

  it('still prefers the Error message over the fallback', () => {
    expect(getErrorMessage(new Error('real'), 'fallback')).toBe('real');
  });
});
