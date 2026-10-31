/**
 * Módulo: groupStore
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: localStorage['y2p-grupo'] não vira nome, HTML nem id solto.
 * Sequência: recusa HTML, script, JSON, id desconhecido e string enorme; com o seletor desligado não devolve nada.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { GROUP_STORAGE_KEY, isAllowedGroupId, multiGroupSelectorEnabled, readGroup } from './groupStore';

const PAYLOADS = [
  '"><img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '{',
  '{"id":"fam"}',
  'fam',
  'casa',
  'eu',
  'grupo-que-nao-existe',
  'x'.repeat(10_000),
  ' FAMILIA ',
  'javascript:alert(1)',
];

afterEach(() => {
  localStorage.clear();
});

describe('readGroup', () => {
  it('recusa HTML, script, JSON quebrado, id inexistente e string enorme', () => {
    for (const payload of PAYLOADS) {
      localStorage.setItem(GROUP_STORAGE_KEY, payload);
      expect(readGroup()).toBeNull();
      expect(readGroup()).not.toBe(payload);
      expect(isAllowedGroupId(payload)).toBe(false);
    }
  });

  it('não oferece seletor múltiplo e não aceita o id de exemplo', () => {
    expect(multiGroupSelectorEnabled()).toBe(false);
    localStorage.setItem(GROUP_STORAGE_KEY, 'casa');
    expect(readGroup()).toBeNull();
  });
});
