/**
 * Módulo: FilterBar
 * Criado em: 2026-10-31
 * Última atualização: 2026-10-31
 * Intuito: O modal de filtros herda o tema da família. As setas andam numa faixa
 * contínua de meses; menu, grade e datas do período ficam com os meses com gasto.
 * Sequência: abrir Filtros coloca o diálogo num .fam-shell, fora do cartão escuro do body.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { monthArrowRange, saoPauloMonth } from './painel-format';
import { EMPTY_FILTERS, FilterBar } from './FilterBar';

// Meio-dia de 15/10/2026 em São Paulo: longe da virada do mês.
const FIXED_NOW = new Date('2026-10-15T15:00:00Z');

describe('modal de filtros', () => {
  it('abre dentro de um .fam-shell para herdar o tema claro', () => {
    const month = saoPauloMonth();
    render(
      <div className="fam-shell">
        <FilterBar
          month={month}
          months={[month]}
          arrowRange={monthArrowRange([month])}
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

function renderBar(month: string, expenseMonths: string[], onMonth: (next: string) => void = () => undefined) {
  return render(
    <FilterBar
      month={month}
      months={expenseMonths}
      arrowRange={monthArrowRange(expenseMonths)}
      totals={{}}
      expenses={[]}
      filters={EMPTY_FILTERS}
      onFilters={() => undefined}
      onMonth={onMonth}
      onApply={() => undefined}
    />,
  );
}

describe('setas do mês', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('D-06: anda do primeiro gasto até o mês seguinte, sem pular o vazio', () => {
    const onMonth = vi.fn();
    renderBar('2026-10', ['2026-08', '2026-10'], onMonth);

    const previous = screen.getByRole('button', { name: 'Mês anterior' });
    const next = screen.getByRole('button', { name: 'Próximo mês' });
    expect(previous).toBeEnabled();
    expect(next).toBeEnabled();
    fireEvent.click(previous);
    expect(onMonth).toHaveBeenCalledWith('2026-09');
    fireEvent.click(next);
    expect(onMonth).toHaveBeenCalledWith('2026-11');
  });

  it('D-06: trava na primeira despesa e no mês seguinte ao atual', () => {
    const onMonth = vi.fn();
    const { unmount } = renderBar('2026-08', ['2026-08', '2026-10'], onMonth);
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeEnabled();
    unmount();

    renderBar('2026-11', ['2026-08', '2026-10'], onMonth);
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(onMonth).toHaveBeenCalledWith('2026-10');
  });

  it('D-06: gasto depois do mês seguinte continua alcançável pela seta', () => {
    const onMonth = vi.fn();
    const { unmount } = renderBar('2027-01', ['2026-08', '2026-10', '2027-02'], onMonth);
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(onMonth).toHaveBeenCalledWith('2027-02');
    unmount();

    renderBar('2027-02', ['2026-08', '2026-10', '2027-02'], onMonth);
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled();
  });

  it('D-06: mês aberto fora do limite volta para a ponta da faixa', () => {
    const onMonth = vi.fn();
    renderBar('1000-01', ['1000-01', '2026-10'], onMonth);
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(onMonth).toHaveBeenCalledWith('2023-10');
  });
});

describe('filtros ficam com os meses com gasto', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('D-06: o menu de mês não mostra mês vazio nem o mês seguinte', () => {
    renderBar('2026-10', ['2026-08', '2026-10']);
    fireEvent.click(screen.getByRole('button', { name: /Período/ }));
    const options = within(screen.getByRole('listbox', { name: 'Escolher mês' })).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringMatching(/^Outubro/),
      expect.stringMatching(/^Agosto/),
    ]);
  });

  it('D-06: a grade do modal só tem os meses com gasto', () => {
    renderBar('2026-10', ['2026-08', '2026-10']);
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtros' });
    expect(within(dialog).getByRole('button', { name: /^Ago/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^Out/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Set/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Nov/ })).toBeNull();
  });

  it('D-06: a data máxima e o “Desde” seguem os meses com gasto', () => {
    renderBar('2026-10', ['2026-08', '2026-10']);
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    expect(screen.getByLabelText('De')).toHaveAttribute('min', '2026-08-01');
    expect(screen.getByLabelText('De')).toHaveAttribute('max', '2026-10-15');
    expect(screen.getByLabelText('Até')).toHaveAttribute('max', '2026-10-15');
    expect(screen.getByRole('button', { name: 'Desde agosto' })).toBeInTheDocument();
  });

  it('D-06: com gasto futuro a data máxima vai até o fim daquele mês', () => {
    renderBar('2026-10', ['2026-08', '2026-10', '2027-02']);
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    expect(screen.getByLabelText('Até')).toHaveAttribute('max', '2027-02-28');
  });
});
