/**
 * Módulo: FilterBar
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: O modal de filtros herda o tema da família.
 * Sequência: abrir Filtros coloca o diálogo num .fam-shell, fora do cartão escuro do body.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { saoPauloMonth, shiftMonth } from './painel-format';
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

describe('setas do mês', () => {
  function renderBar(month: string, months: string[], onMonth: (next: string) => void) {
    render(
      <FilterBar
        month={month}
        months={months}
        totals={{}}
        expenses={[]}
        filters={EMPTY_FILTERS}
        onFilters={() => undefined}
        onMonth={onMonth}
        onApply={() => undefined}
      />,
    );
  }

  it('D-06: anda do primeiro gasto até o mês seguinte, sem pular o vazio', () => {
    const today = saoPauloMonth();
    const first = shiftMonth(today, -2);
    const gap = shiftMonth(today, -1);
    const upcoming = shiftMonth(today, 1);
    const onMonth = vi.fn();
    renderBar(today, [first, today], onMonth);

    const previous = screen.getByRole('button', { name: 'Mês anterior' });
    const next = screen.getByRole('button', { name: 'Próximo mês' });
    expect(previous).toBeEnabled();
    expect(next).toBeEnabled();
    fireEvent.click(previous);
    expect(onMonth).toHaveBeenCalledWith(gap);
    fireEvent.click(next);
    expect(onMonth).toHaveBeenCalledWith(upcoming);
  });

  it('D-06: trava na primeira despesa e no mês seguinte ao atual', () => {
    const today = saoPauloMonth();
    const first = shiftMonth(today, -2);
    const upcoming = shiftMonth(today, 1);
    const onMonth = vi.fn();
    const { rerender } = render(
      <FilterBar
        month={first}
        months={[first, today]}
        totals={{}}
        expenses={[]}
        filters={EMPTY_FILTERS}
        onFilters={() => undefined}
        onMonth={onMonth}
        onApply={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeEnabled();

    rerender(
      <FilterBar
        month={upcoming}
        months={[first, today]}
        totals={{}}
        expenses={[]}
        filters={EMPTY_FILTERS}
        onFilters={() => undefined}
        onMonth={onMonth}
        onApply={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(onMonth).toHaveBeenCalledWith(today);
  });
});
