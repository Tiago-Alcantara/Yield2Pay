'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ExpenseCategory, ExpenseView } from '@yield2pay/shared';
import { useIsMobile } from '@/lib/useIsMobile';
import {
  CATEGORY_LABEL,
  brl0,
  brlK,
  cap,
  daysInMonth,
  mesNome,
  reais,
  saoPauloDay,
  saoPauloMonth,
  saoPauloToday,
} from './painel-format';

export type ExpenseFilters = {
  mode: 'mes' | 'custom';
  from: string;
  to: string;
  cats: ExpenseCategory[];
  tipo: 'todos' | 'fixo' | 'var';
  min: string;
  max: string;
  q: string;
};

type Draft = ExpenseFilters & { month: string };

export const EMPTY_FILTERS: ExpenseFilters = {
  mode: 'mes',
  from: '',
  to: '',
  cats: [],
  tipo: 'todos',
  min: '',
  max: '',
  q: '',
};

const CATEGORY_BY_LABEL = Object.fromEntries(
  (Object.entries(CATEGORY_LABEL) as [ExpenseCategory, string][]).map(([id, label]) => [label, id]),
) as Record<string, ExpenseCategory>;

export function categoryId(label: string): ExpenseCategory | null {
  return CATEGORY_BY_LABEL[label] ?? null;
}

export function foldSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function matchesExpense(row: ExpenseView, filters: ExpenseFilters, month?: string): boolean {
  if (filters.mode === 'custom') {
    if (!filters.from || !filters.to) return false;
    const [from, to] = filters.from <= filters.to ? [filters.from, filters.to] : [filters.to, filters.from];
    if (row.date < from || row.date > to) return false;
  } else if (month && row.date.slice(0, 7) !== month) {
    return false;
  }
  if (filters.cats.length && !filters.cats.includes(row.category)) return false;
  if (filters.tipo === 'fixo' && !row.fixed) return false;
  if (filters.tipo === 'var' && row.fixed) return false;
  const value = reais(row.amountCents);
  if (filters.min !== '' && value < Number(filters.min)) return false;
  if (filters.max !== '' && value > Number(filters.max)) return false;
  const query = foldSearch(filters.q.trim());
  if (query && !foldSearch(row.merchant).includes(query)) return false;
  return true;
}

export function moneyFilterError(min: string, max: string): string {
  const minValue = min === '' ? null : Number(min);
  const maxValue = max === '' ? null : Number(max);
  if ((minValue != null && (!Number.isFinite(minValue) || minValue < 0)) || (maxValue != null && (!Number.isFinite(maxValue) || maxValue < 0))) {
    return 'O valor não pode ser negativo.';
  }
  if (minValue != null && maxValue != null && minValue > maxValue) {
    return 'O mínimo está maior que o máximo.';
  }
  return '';
}

function monthBounds(month: string, today = saoPauloToday()) {
  const from = `${month}-01`;
  const end = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  const to = today.slice(0, 7) === month && today < end ? today : end;
  return { from, to };
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayCount(from: string, to: string) {
  const [start, end] = from <= to ? [from, to] : [to, from];
  return Math.round((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86400000) + 1;
}

function shortDate(iso: string) {
  return `${Number(iso.slice(8, 10))} ${mesNome(iso.slice(0, 7)).slice(0, 3)}`;
}

function rangeLabel(filters: ExpenseFilters) {
  if (!filters.from || !filters.to) return 'Escolha as datas';
  return `${shortDate(filters.from)} a ${shortDate(filters.to)}`;
}

function moneyLabel(filters: ExpenseFilters) {
  const min = filters.min === '' ? null : Number(filters.min);
  const max = filters.max === '' ? null : Number(filters.max);
  if (min != null && max != null) return `${brl0(min)} a ${brl0(max)}`;
  if (min != null) return `Acima de ${brl0(min)}`;
  if (max != null) return `Até ${brl0(max)}`;
  return '';
}

export function filterChips(filters: ExpenseFilters): { key: string; label: string; clear: Partial<ExpenseFilters> }[] {
  const chips: { key: string; label: string; clear: Partial<ExpenseFilters> }[] = [];
  if (filters.mode === 'custom') chips.push({ key: 'range', label: rangeLabel(filters), clear: { mode: 'mes' } });
  filters.cats.forEach((category) => {
    chips.push({
      key: category,
      label: CATEGORY_LABEL[category],
      clear: { cats: filters.cats.filter((item) => item !== category) },
    });
  });
  if (filters.tipo === 'fixo') chips.push({ key: 'tipo', label: 'Só fixos', clear: { tipo: 'todos' } });
  if (filters.tipo === 'var') chips.push({ key: 'tipo', label: 'Só variáveis', clear: { tipo: 'todos' } });
  if (filters.min !== '' || filters.max !== '') chips.push({ key: 'valor', label: moneyLabel(filters), clear: { min: '', max: '' } });
  if (filters.q.trim()) chips.push({ key: 'q', label: `“${filters.q.trim()}”`, clear: { q: '' } });
  return chips;
}

const chromeOn: CSSProperties = {
  border: 'none',
  background: 'linear-gradient(180deg,#F2F3F4,#A8AAAD)',
  color: '#0E0F11',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)',
  fontWeight: 600,
};
const chromeOff: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#9A9DA1',
  fontWeight: 600,
};

export function FilterBar({
  month,
  months,
  totals,
  expenses,
  filters,
  onFilters,
  onMonth,
  onApply,
}: {
  month: string;
  months: string[];
  totals: Record<string, number>;
  expenses: ExpenseView[];
  filters: ExpenseFilters;
  onFilters: (next: ExpenseFilters) => void;
  onMonth: (month: string) => void;
  onApply: (filters: ExpenseFilters, month: string) => void;
}) {
  const isMobile = useIsMobile();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const today = saoPauloToday();
  const chips = filterChips(filters);
  const index = Math.max(0, months.indexOf(month));
  const label = filters.mode === 'custom' ? rangeLabel(filters) : `${cap(mesNome(month))} ${month.slice(0, 4)}`;
  const controlHeight = isMobile ? 44 : 52;

  useEffect(() => {
    if (!menu) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenu(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenu(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  function openModal(mode?: ExpenseFilters['mode']) {
    const bounds = monthBounds(month, today);
    setMenu(false);
    setDraft({
      ...filters,
      from: filters.from || bounds.from,
      to: filters.to || bounds.to,
      month,
      ...(mode ? { mode } : {}),
    });
    setOpen(true);
  }

  function chooseMonth(next: string) {
    setMenu(false);
    onMonth(next);
  }

  const options = [...months].reverse();

  return (
    <div ref={rootRef} className="y2p-filterbar" style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'stretch' : 'flex-end', gap: 10, width: isMobile ? '100%' : undefined, minWidth: 0 }}>
      <div className="y2p-filterbar-row" style={{ display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', gap: isMobile ? 8 : 8, alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'flex-end', width: isMobile ? '100%' : undefined, minWidth: 0 }}>
        <div className="y2p-period" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 2, height: controlHeight, padding: isMobile ? '0 4px' : '0 6px', borderRadius: 999, border: '1px solid #2A2D31', background: '#131417', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)', flex: isMobile ? '1 1 0' : undefined, minWidth: 0, maxWidth: '100%' }}>
          <button type="button" aria-label="Mês anterior" disabled={index <= 0} onClick={() => chooseMonth(months[index - 1])} className="y2p-hover" style={arrowStyle(index <= 0, isMobile)}>‹</button>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={menu}
            aria-controls={menuId}
            onClick={() => setMenu((current) => !current)}
            className="y2p-hover"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 6 : 14, height: isMobile ? 36 : 42, minWidth: isMobile ? 0 : 176, flex: isMobile ? '1 1 0' : undefined, padding: isMobile ? '0 6px' : '0 12px', border: 'none', borderRadius: 12, background: 'transparent', color: '#F2F3F4', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', overflow: 'hidden' }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, overflow: 'hidden' }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#8a8d91' }}>Período</span>
              <span style={{ fontSize: isMobile ? 13.5 : 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            </span>
            <span style={{ fontSize: 10, color: '#9A9DA1', flex: 'none' }}>▼</span>
          </button>
          <button type="button" aria-label="Próximo mês" disabled={index >= months.length - 1} onClick={() => chooseMonth(months[index + 1])} className="y2p-hover" style={arrowStyle(index >= months.length - 1, isMobile)}>›</button>
          {menu && (
            <div id={menuId} role="listbox" aria-label="Escolher mês" style={{ position: 'absolute', right: isMobile ? 'auto' : 0, left: isMobile ? 0 : 'auto', top: 'calc(100% + 10px)', zIndex: 31, width: 'min(300px, 86vw)', padding: 6, borderRadius: 16, border: '1px solid #3a3d42', background: 'linear-gradient(160deg,#1e2024,#131417)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 30px 60px -20px rgba(0,0,0,.9)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {options.map((item) => {
                const on = filters.mode !== 'custom' && item === month;
                const partial = item === saoPauloMonth();
                return (
                  <button
                    key={item}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => chooseMonth(item)}
                    className={on ? undefined : 'y2p-quiet'}
                    style={on
                      ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, height: 42, padding: '0 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#3c3f44,#26282c 60%,#1b1d21)', boxShadow: 'inset 0 0 0 1px #4a4d52', color: '#F2F3F4', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }
                      : { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, height: 42, padding: '0 12px', borderRadius: 10, border: 'none', background: 'transparent', color: '#C0C2C5', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                  >
                    <span>{cap(mesNome(item)) + (partial ? ` · até dia ${saoPauloDay()}` : '')}</span>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: on ? '#C0C2C5' : '#8a8d91' }}>{brlK(reais(totals[item] ?? 0))}</span>
                  </button>
                );
              })}
              <div style={{ height: 1, background: '#2A2D31', margin: '4px 6px' }} />
              <button type="button" onClick={() => openModal('custom')} className="y2p-quiet" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 48, padding: '6px 12px', borderRadius: 10, border: 'none', background: 'transparent', color: '#E6E8EA', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>Período personalizado</span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: '#8a8d91' }}>{filters.mode === 'custom' ? rangeLabel(filters) : 'Escolha as datas'}</span>
                </span>
                <span style={{ color: '#9A9DA1' }}>›</span>
              </button>
            </div>
          )}
        </div>
        <button type="button" onClick={() => openModal()} className="y2p-filter" style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 10, height: controlHeight, padding: isMobile ? '0 14px 0 12px' : '0 20px 0 18px', borderRadius: 999, border: '1px solid #3a3d42', background: 'linear-gradient(180deg,#26282c,#16181b)', color: '#E6E8EA', fontFamily: 'inherit', fontSize: isMobile ? 13.5 : 14.5, fontWeight: 600, cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)', flex: 'none', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }} aria-hidden="true">
            <span style={{ width: 16, height: 1.5, background: 'currentColor' }} />
            <span style={{ width: 11, height: 1.5, background: 'currentColor' }} />
            <span style={{ width: 6, height: 1.5, background: 'currentColor' }} />
          </span>
          Filtros
          {chips.length > 0 && (
            <span style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999, background: 'linear-gradient(180deg,#F2F3F4,#A8AAAD)', color: '#0E0F11', fontFamily: "'Geist Mono', monospace", fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{chips.length}</span>
          )}
        </button>
      </div>
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#8a8d91', marginRight: 4 }}>Filtros ativos</span>
          {chips.map((chip) => (
            <button key={chip.key} type="button" aria-label={`Remover filtro ${chip.label}`} onClick={() => onFilters({ ...filters, ...chip.clear })} className="y2p-filter" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px 0 13px', borderRadius: 999, border: '1px solid #3a3d42', background: '#131417', color: '#E6E8EA', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {chip.label}
              <span style={{ color: '#9A9DA1', fontSize: 14 }}>×</span>
            </button>
          ))}
          <button type="button" onClick={() => onFilters(EMPTY_FILTERS)} className="y2p-linkish" style={{ border: 'none', background: 'none', padding: '0 6px', fontFamily: 'inherit', fontSize: 13, color: '#9A9DA1', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>Limpar tudo</button>
        </div>
      )}
      {open && draft && typeof document !== 'undefined' && createPortal(
        <FiltersModal
          draft={draft}
          totals={totals}
          months={months}
          expenses={expenses}
          loadedMonth={month}
          today={today}
          onDraft={setDraft}
          onClose={() => setOpen(false)}
          onApply={(next, nextMonth) => {
            setOpen(false);
            onApply(next, nextMonth);
          }}
        />,
        document.body,
      )}
    </div>
  );
}

function arrowStyle(disabled: boolean, compact = false): CSSProperties {
  return {
    width: compact ? 30 : 36,
    height: compact ? 30 : 36,
    flex: 'none',
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    color: '#9A9DA1',
    fontFamily: 'inherit',
    fontSize: compact ? 16 : 18,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.35 : 1,
  };
}

function FiltersModal({
  draft,
  totals,
  months,
  expenses,
  loadedMonth,
  today,
  onDraft,
  onClose,
  onApply,
}: {
  draft: Draft;
  totals: Record<string, number>;
  months: string[];
  expenses: ExpenseView[];
  loadedMonth: string;
  today: string;
  onDraft: (next: Draft) => void;
  onClose: () => void;
  onApply: (filters: ExpenseFilters, month: string) => void;
}) {
  const [moneyError, setMoneyError] = useState('');
  const matched = expenses.filter((row) => matchesExpense(row, draft, draft.mode === 'custom' ? undefined : draft.month)).length;
  const monthLoaded = expenses.some((row) => row.date.slice(0, 7) === draft.month);
  const canApply = draft.mode === 'custom' ? Boolean(draft.from && draft.to) : monthLoaded ? matched > 0 : true;
  const applyLabel = matched > 0
    ? `Mostrar ${matched} ${matched === 1 ? 'gasto' : 'gastos'}`
    : draft.mode === 'custom' ? 'Mostrar período' : 'Mostrar mês';
  const earliest = months[0] ?? loadedMonth;
  const latestExpense = months.at(-1) ?? loadedMonth;
  const minDate = `${earliest}-01`;
  const maxDate = [today, monthBounds(latestExpense, today).to].sort().at(-1) ?? today;
  const presets = [
    ['Últimos 7 dias', addDays(today, -6)],
    ['Últimos 30 dias', addDays(today, -29)],
    ['Últimos 90 dias', addDays(today, -89)],
    [`Desde ${mesNome(earliest)}`, `${earliest}-01`],
  ] as const;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function patch(partial: Partial<Draft>) {
    onDraft({ ...draft, ...partial });
  }

  function apply() {
    const problem = moneyFilterError(draft.min, draft.max);
    if (problem) {
      setMoneyError(problem);
      return;
    }
    setMoneyError('');
    const from = draft.from && draft.to && draft.from > draft.to ? draft.to : draft.from;
    const to = draft.from && draft.to && draft.from > draft.to ? draft.from : draft.to;
    const { month: nextMonth, ...rest } = draft;
    onApply({ ...rest, from, to }, nextMonth);
  }

  return (
    <div role="presentation" className="y2p-overlay" style={{ zIndex: 60, background: 'rgba(8,9,10,.72)', alignItems: 'flex-start', padding: '5vh 16px' }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Filtros" style={{ position: 'relative', maxWidth: 580, width: '100%', borderRadius: 24, border: '1px solid #3a3d42', background: 'linear-gradient(160deg,#1e2024,#131417)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 30px 80px -30px rgba(0,0,0,.8)', display: 'flex', flexDirection: 'column', animation: 'y2pIn .35s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '22px 24px 18px' }}>
          <div>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#8a8d91' }}>Gastos</div>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: '6px 0 0' }}>Filtros</h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="y2p-filter" style={{ width: 40, height: 40, borderRadius: 999, border: '1px solid #3a3d42', background: '#131417', color: '#C0C2C5', fontFamily: 'inherit', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 24px', borderTop: '1px solid #2A2D31' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9A9DA1' }}>Período</div>
            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, border: '1px solid #2A2D31', background: '#0E0F11' }}>
              {([['mes', 'Por mês'], ['custom', 'Personalizado']] as const).map(([key, text]) => (
                <button key={key} type="button" aria-pressed={draft.mode === key} onClick={() => patch({ mode: key })} style={{ height: 32, padding: '0 14px', borderRadius: 999, fontFamily: 'inherit', fontSize: 13.5, cursor: 'pointer', ...(draft.mode === key ? chromeOn : chromeOff) }}>{text}</button>
              ))}
            </div>
          </div>
          {draft.mode !== 'custom' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 120px), 1fr))', gap: 8 }}>
              {months.map((item) => {
                const on = draft.month === item;
                return (
                  <button key={item} type="button" aria-pressed={on} onClick={() => patch({ month: item })} className={on ? undefined : 'y2p-filter'} style={on
                    ? { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '12px 14px', borderRadius: 14, border: '1px solid #E6E8EA', background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)', color: '#0E0F11', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }
                    : { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '12px 14px', borderRadius: 14, border: '1px solid #3a3d42', background: '#131417', color: '#E6E8EA', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 15, fontWeight: on ? 700 : 600 }}>{cap(mesNome(item).slice(0, 3))}</span>
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: on ? '#2A2D31' : '#8a8d91' }}>{brlK(reais(totals[item] ?? 0))}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {presets.map(([text, from]) => {
                  const on = draft.from === from && draft.to === today;
                  return (
                    <button key={text} type="button" aria-pressed={on} onClick={() => patch({ from, to: today })} style={{ height: 34, padding: '0 14px', borderRadius: 999, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', ...(on ? { ...chromeOn, border: '1px solid #E6E8EA' } : { border: '1px solid #3a3d42', background: '#131417', color: '#C0C2C5', fontWeight: 500 }) }}>{text}</button>
                  );
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, color: '#9A9DA1' }}>
                  De
                  <input type="date" aria-label="De" value={draft.from} min={minDate} max={maxDate} onChange={(event) => patch({ from: event.target.value })} style={dateStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, color: '#9A9DA1' }}>
                  Até
                  <input type="date" aria-label="Até" value={draft.to} min={minDate} max={maxDate} onChange={(event) => patch({ to: event.target.value })} style={dateStyle} />
                </label>
              </div>
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: '#8a8d91' }}>
                {draft.from && draft.to ? `${dayCount(draft.from, draft.to)} dias selecionados` : 'Escolha as duas datas'}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 24px', borderTop: '1px solid #2A2D31' }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9A9DA1' }}>Categorias</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <CatButton label="Todas" on={draft.cats.length === 0} onClick={() => patch({ cats: [] })} />
            {(Object.entries(CATEGORY_LABEL) as [ExpenseCategory, string][]).map(([id, label]) => (
              <CatButton
                key={id}
                label={label}
                on={draft.cats.includes(id)}
                onClick={() => patch({ cats: draft.cats.includes(id) ? draft.cats.filter((item) => item !== id) : [...draft.cats, id] })}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '20px 24px', borderTop: '1px solid #2A2D31' }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9A9DA1' }}>Tipo de gasto</div>
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, border: '1px solid #2A2D31', background: '#0E0F11' }}>
            {([['todos', 'Todos'], ['fixo', 'Fixos'], ['var', 'Variáveis']] as const).map(([key, text]) => (
              <button key={key} type="button" aria-pressed={draft.tipo === key} onClick={() => patch({ tipo: key })} style={{ height: 32, padding: '0 14px', borderRadius: 999, fontFamily: 'inherit', fontSize: 13.5, cursor: 'pointer', ...(draft.tipo === key ? chromeOn : chromeOff) }}>{text}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 24px', borderTop: '1px solid #2A2D31' }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9A9DA1' }}>Valor do gasto</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
            <label style={moneyField}>
              Mín. R$
              <input type="number" inputMode="decimal" min={0} placeholder="0" aria-label="Valor mínimo" value={draft.min} onChange={(event) => { setMoneyError(''); patch({ min: event.target.value }); }} style={moneyInput} />
            </label>
            <label style={moneyField}>
              Máx. R$
              <input type="number" inputMode="decimal" min={0} placeholder="sem limite" aria-label="Valor máximo" value={draft.max} onChange={(event) => { setMoneyError(''); patch({ max: event.target.value }); }} style={moneyInput} />
            </label>
          </div>
          {moneyError && <div style={{ fontSize: 14, color: '#E6E8EA' }}>{moneyError}</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 24px', borderTop: '1px solid #2A2D31' }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9A9DA1' }}>Estabelecimento</div>
          <input type="search" placeholder="Ex.: iFood, Carrefour" aria-label="Buscar estabelecimento" value={draft.q} onChange={(event) => patch({ q: event.target.value })} style={{ height: 46, width: '100%', padding: '0 14px', borderRadius: 12, border: '1px solid #3a3d42', background: '#0E0F11', color: '#E6E8EA', fontFamily: 'inherit', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '18px 24px', borderTop: '1px solid #3a3d42', borderRadius: '0 0 24px 24px', background: '#16181b' }}>
          <button type="button" onClick={() => onDraft({ ...EMPTY_FILTERS, ...monthBounds(loadedMonth, today), month: loadedMonth })} className="y2p-linkish" style={{ height: 48, padding: '0 4px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 14.5, color: '#9A9DA1', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>Limpar filtros</button>
          {canApply ? (
            <button type="button" onClick={apply} style={{ height: 48, padding: '0 26px', borderRadius: 999, border: 'none', background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)', color: '#0E0F11', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)' }}>
              {applyLabel}
            </button>
          ) : (
            <button type="button" disabled style={{ height: 48, padding: '0 26px', borderRadius: 999, border: '1px solid #2A2D31', background: '#131417', color: '#8A8D91', fontFamily: 'inherit', fontSize: 15, fontWeight: 600 }}>Nenhum gasto encontrado</button>
          )}
        </div>
      </div>
    </div>
  );
}

function CatButton({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} style={{ height: 34, padding: '0 14px', borderRadius: 999, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', ...(on ? { ...chromeOn, border: '1px solid #E6E8EA' } : { border: '1px solid #3a3d42', background: '#131417', color: '#C0C2C5', fontWeight: 500 }) }}>
      {label}
    </button>
  );
}

const dateStyle: CSSProperties = {
  height: 46,
  width: '100%',
  padding: '0 14px',
  borderRadius: 12,
  border: '1px solid #3a3d42',
  background: '#0E0F11',
  color: '#E6E8EA',
  fontFamily: "'Geist Mono', monospace",
  fontSize: 14.5,
  outline: 'none',
  boxSizing: 'border-box',
  colorScheme: 'dark',
};

const moneyField: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 46,
  padding: '0 14px',
  borderRadius: 12,
  border: '1px solid #3a3d42',
  background: '#0E0F11',
  fontSize: 13.5,
  color: '#8a8d91',
};

const moneyInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: '100%',
  border: 'none',
  background: 'transparent',
  color: '#E6E8EA',
  fontFamily: "'Geist Mono', monospace",
  fontSize: 14.5,
  outline: 'none',
};
