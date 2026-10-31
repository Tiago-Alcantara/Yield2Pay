import { describe, expect, it } from 'vitest';
import { activeDockItem, showsDock } from './Dock';

describe('doca', () => {
  it('aparece só nas telas logadas da família', () => {
    expect(showsDock('/dashboard')).toBe(true);
    expect(showsDock('/dashboard/abc')).toBe(true);
    expect(showsDock('/aprender')).toBe(true);
    expect(showsDock('/configuracoes')).toBe(true);
    expect(showsDock('/')).toBe(false);
    expect(showsDock('/onboarding')).toBe(false);
    expect(showsDock('/b2b')).toBe(false);
  });

  it('marca o item ativo pela rota', () => {
    expect(activeDockItem('/aprender')).toBe('aprender');
    expect(activeDockItem('/conceitos')).toBe('aprender');
    expect(activeDockItem('/configuracoes')).toBeNull();
    expect(activeDockItem('/dashboard')).toBe('painel');
    expect(activeDockItem('/conta')).toBe('painel');
  });
});
