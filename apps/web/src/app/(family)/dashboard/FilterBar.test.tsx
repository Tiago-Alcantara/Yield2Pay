/**
 * Módulo: FilterBar
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: O modal de filtros herda o tema da família.
 * Sequência: abrir Filtros coloca o diálogo num .fam-shell, fora do cartão escuro do body.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { saoPauloMonth } from './painel-format';
import { EMPTY_FILTERS, FilterBar } from './FilterBar';

describe('modal de filtros', () => {
  it('abre dentro de um .fam-shell para herdar o tema claro', () => {
    const month = saoPauloMonth();
    render(
      <div className="fam-shell">
        <FilterBar
          month={month}
          months={[month]}
          totals={{}}
          expenses={[]}
          filters={EMPTY_FILTERS}
          onFilters={() => undefined}
          onMonth={() => undefined}
          onApply={() => undefined}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtros' });
    const portal = dialog.closest('.fam-portal');
    expect(portal).not.toBeNull();
    expect(portal).toHaveClass('fam-shell');
    expect(portal).not.toBe(document.querySelector('.fam-shell'));
  });
});
