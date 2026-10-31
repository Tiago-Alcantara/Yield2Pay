/**
 * Módulo: tokens do tema claro
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: Iniciais, campo e badge não ficam presos no grafite escuro.
 * Sequência: wellDeep, avatar, chip e o número de /conceitos usam --fam-*.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SegmentedControl } from '@/components/SegmentedControl';
import { NumberTile } from '../_components/FamilyUI';
import { C } from './familyTheme';

describe('tokens do tema claro', () => {
  it('troca o grafite fixo por --fam-avatar, --fam-well-deep e --fam-chip-on', () => {
    expect(C.wellDeep).toContain('--fam-well-deep');
    expect(C.tile).toContain('--fam-avatar');
    expect(C.wellDeep).not.toBe('#0f1113');
    expect(C.tile).not.toBe('linear-gradient(160deg,#43464b,#1b1d21)');

    render(<SegmentedControl options={['Mês', 'Ano']} value="Mês" />);
    const selected = screen.getByRole('button', { name: 'Mês' }).getAttribute('style') ?? '';
    expect(selected).toContain('--fam-chip-on');
    expect(selected).toContain('#2E3136');
    expect(selected).not.toContain('--fx-surface-3');
    expect(selected).toContain('--fam-on-chip');

    render(<NumberTile>1</NumberTile>);
    expect(document.body.innerHTML).toContain('--fam-avatar');
  });
});
