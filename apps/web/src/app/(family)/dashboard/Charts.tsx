import type { HouseholdSummary } from '@yield2pay/shared';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  CATEGORY_LABEL,
  CHARTS,
  SHADES,
  type ChartId,
  brl,
  brl0,
  brlK,
  cap,
  daysInMonth,
  mesNome,
  reais,
  saoPauloMonth,
  shiftMonth,
} from './painel-format';

const short = (m: string) => mesNome(m).slice(0, 3) + (m === saoPauloMonth() ? '*' : '');

export function Charts({
  month,
  chart,
  summary,
  onChart,
  onPickMonth,
  onPickCat,
}: {
  month: string;
  chart: ChartId;
  summary: HouseholdSummary;
  onChart: (chart: ChartId) => void;
  onPickMonth: (month: string) => void;
  onPickCat: (label: string) => void;
}) {
  const mName = mesNome(month);
  const partial = month === saoPauloMonth();
  const days = daysInMonth(month);
  const total = summary.monthTotalCents;
  const proj = summary.projectedCents;
  const prevEnd = summary.dailyPace.previous.length
    ? summary.dailyPace.previous[summary.dailyPace.previous.length - 1]
    : 0;
  const pName = mesNome(shiftMonth(month, -1));
  const cats = summary.byCategory.map(
    (row) => [CATEGORY_LABEL[row.category], row.amountCents] as const,
  );
  const monthTotals = summary.lastSixMonths.map((row) => row.amountCents);
  const maxM = ((monthTotals.length ? Math.max(...monthTotals) : 0) * 1.06) || 1;

  const upcoming = month > saoPauloMonth();
  const desc = {
    cat: upcoming
      ? cap(mName) + ' ainda não começou. O que aparece aqui foi lançado com data futura.'
      : 'Onde o dinheiro de ' + mName + ' foi parar. Toque numa categoria para ver os gastos.',
    mes: 'Total de cada mês. A linha tracejada é a média dos meses fechados.',
    ritmo: upcoming
      ? cap(mName) + ' ainda não começou.'
      : partial
      ? 'No ritmo atual, ' +
        mName +
        ' fecha em ' +
        brl0(reais(proj)) +
        (summary.dailyPace.previous.length
          ? ', ' +
            brl0(reais(Math.abs(proj - prevEnd))) +
            (proj > prevEnd ? ' a mais' : ' a menos') +
            ' que ' +
            pName +
            '.'
          : '.')
      : cap(mName) +
        ' fechou em ' +
        brl0(reais(total)) +
        (summary.dailyPace.previous.length ? '; ' + pName + ' em ' + brl0(reais(prevEnd)) + '.' : '.'),
    fixo: 'Fixos vêm todo mês. Variáveis dependem das escolhas do mês, e é onde dá para mexer.',
  }[chart];

  return (
    <section className="y2p-charts" data-screen-label="Gráficos">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#F2F3F4', margin: 0 }}>Seus gastos</h2>
          <p style={{ fontSize: 13.5, color: '#9A9DA1', margin: '6px 0 0', lineHeight: 1.55 }}>{desc}</p>
        </div>
        <SegmentedControl
          size="sm"
          options={CHARTS.map(([value, label]) => ({ value, label }))}
          value={chart}
          onChange={(value) => onChart(value as ChartId)}
        />
      </div>
      <div key={chart} className="y2p-reveal">
        {chart === 'cat' && <Donut cats={cats} total={total} mName={mName} onPickCat={onPickCat} />}
        {chart === 'mes' && (
          <MonthBars month={month} months={summary.lastSixMonths} averageCents={summary.averageCents} maxM={maxM} onPickMonth={onPickMonth} />
        )}
        {chart === 'ritmo' && (
          <Ritmo
            current={summary.dailyPace.current}
            previous={summary.dailyPace.previous}
            partial={partial}
            days={days}
            proj={proj}
            mName={mName}
            pName={pName}
          />
        )}
        {chart === 'fixo' && (
          <FixVar month={month} rows={summary.fixedVsVariable} maxM={maxM} onPickMonth={onPickMonth} />
        )}
      </div>
    </section>
  );
}

function Donut({
  cats,
  total,
  mName,
  onPickCat,
}: {
  cats: readonly (readonly [string, number])[];
  total: number;
  mName: string;
  onPickCat: (label: string) => void;
}) {
  const C = 2 * Math.PI * 80;
  let acc = 0;
  return (
    <div className="y2p-donut-wrap">
      <div className="y2p-donut">
        <svg viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="#1e2024" strokeWidth="26" />
          {total > 0 &&
            cats.map(([c, v], i) => {
              const len = (v / total) * C;
              const el = (
                <circle
                  key={c}
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke={SHADES[i % 8]}
                  strokeWidth="26"
                  strokeDasharray={Math.max(0, len - 2.5) + ' ' + C}
                  strokeDashoffset={-acc}
                  transform="rotate(-90 100 100)"
                />
              );
              acc += len;
              return el;
            })}
        </svg>
        <div className="y2p-donut-center">
          <div className="y2p-mono" style={{ fontSize: 20, fontWeight: 600, color: '#F2F3F4' }}>
            {brlK(reais(total))}
          </div>
          <div style={{ fontSize: 12.5, color: '#8a8d91', marginTop: 2 }}>{mName}</div>
        </div>
      </div>
      <div className="y2p-catlist">
        {cats.map(([c, v], i) => (
          <button key={c} type="button" className="y2p-catrow" onClick={() => onPickCat(c)}>
            <span className="y2p-swatch" style={{ background: SHADES[i % 8] }} />
            <span className="y2p-ellipsis">{c}</span>
            <span className="y2p-mono" style={{ fontSize: 12.5, color: '#8a8d91' }}>
              {total ? Math.round((v / total) * 100) : 0}%
            </span>
            <span className="y2p-mono" style={{ color: '#F2F3F4', minWidth: 92, textAlign: 'right' }}>
              {brl(reais(v))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MonthBars({
  month,
  months,
  averageCents,
  maxM,
  onPickMonth,
}: {
  month: string;
  months: HouseholdSummary['lastSixMonths'];
  averageCents: number;
  maxM: number;
  onPickMonth: (month: string) => void;
}) {
  const avgY = 200 - (averageCents / maxM) * 200;
  return (
    <div>
      <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="y2p-bars">
        {months.map((row, i) => {
          const h = (row.amountCents / maxM) * 200;
          const slot = months.length ? 600 / months.length : 100;
          return (
            <rect
              key={row.month}
              x={i * slot + slot * 0.18}
              y={200 - h}
              width={slot * 0.64}
              height={h}
              fill={row.month === month ? '#E6E8EA' : '#3a3d42'}
              onClick={() => onPickMonth(row.month)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
        <line
          x1="0"
          y1={avgY}
          x2="600"
          y2={avgY}
          stroke="#9A9DA1"
          strokeWidth="1.5"
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      </svg>
      <div className="y2p-bar-labels">
        {months.map((row) => (
          <button key={row.month} type="button" onClick={() => onPickMonth(row.month)}>
            <div style={{ fontSize: 13, color: '#9A9DA1' }}>{short(row.month)}</div>
            <div className="y2p-mono" style={{ fontSize: 11.5, color: '#F2F3F4', marginTop: 2 }}>
              {brlK(reais(row.amountCents))}
            </div>
          </button>
        ))}
      </div>
      <div className="y2p-legend">
        <span className="y2p-leg-dash" />
        Média dos meses fechados · {brlK(reais(averageCents))}
      </div>
    </div>
  );
}

function Ritmo({
  current,
  previous,
  partial,
  days,
  proj,
  mName,
  pName,
}: {
  current: number[];
  previous: number[];
  partial: boolean;
  days: number;
  proj: number;
  mName: string;
  pName: string;
}) {
  const prevEnd = previous.length ? previous[previous.length - 1] : 0;
  const maxY = Math.max(proj, prevEnd, 1) * 1.08;
  const X = (i: number) => ((i / 30) * 600).toFixed(1);
  const Y = (v: number) => (200 - (v / maxY) * 200).toFixed(1);
  const path = (arr: number[]) => (arr.length ? 'M' + arr.map((v, i) => X(i) + ' ' + Y(v)).join(' L') : '');
  const n = current.length - 1;
  const last = current[n] || 0;
  const dot = 'M' + X(Math.max(0, n)) + ' ' + Y(last) + ' l0 0';
  return (
    <div>
      <div className="y2p-ritmo">
        <svg viewBox="0 0 600 200" preserveAspectRatio="none">
          <line x1="0" y1="0.5" x2="600" y2="0.5" stroke="#24272b" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="100" x2="600" y2="100" stroke="#24272b" vectorEffect="non-scaling-stroke" />
          <path d={path(previous)} fill="none" stroke="#6A6D72" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
          {current.length > 0 && <path d={path(current) + ' L' + X(n) + ' 200 L0 200 Z'} fill="rgba(230,232,234,.08)" />}
          {partial && current.length > 0 && (
            <path
              d={'M' + X(n) + ' ' + Y(last) + ' L' + X(days - 1) + ' ' + Y(proj)}
              fill="none"
              stroke="#E6E8EA"
              strokeWidth="2"
              strokeDasharray="2 5"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path d={path(current)} fill="none" stroke="#E6E8EA" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {current.length > 0 && (
            <>
              <path d={dot} stroke="rgba(230,232,234,.16)" strokeWidth="21" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={dot} stroke="#E6E8EA" strokeWidth="11" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        <span className="y2p-mono y2p-axis" style={{ top: 4 }}>
          {brlK(reais(maxY))}
        </span>
        <span className="y2p-mono y2p-axis" style={{ top: 'calc(50% + 4px)' }}>
          {brlK(reais(maxY / 2))}
        </span>
      </div>
      <div className="y2p-mono y2p-days">
        <span>dia 1</span>
        <span>dia 10</span>
        <span>dia 20</span>
        <span>dia 31</span>
      </div>
      <div className="y2p-legend" style={{ gap: 18, flexWrap: 'wrap' }}>
        <span className="y2p-leg">
          <span style={{ width: 18, height: 2.5, background: '#E6E8EA' }} />
          {cap(mName)}
        </span>
        {previous.length > 0 && (
          <span className="y2p-leg">
            <span className="y2p-leg-dash" style={{ borderColor: '#6A6D72' }} />
            {cap(pName)}
          </span>
        )}
        {partial && (
          <span className="y2p-leg">
            <span style={{ width: 18, borderTop: '2px dotted #E6E8EA' }} />
            Projeção
          </span>
        )}
      </div>
    </div>
  );
}

function FixVar({
  month,
  rows,
  maxM,
  onPickMonth,
}: {
  month: string;
  rows: HouseholdSummary['fixedVsVariable'];
  maxM: number;
  onPickMonth: (month: string) => void;
}) {
  const current = rows.find((row) => row.month === month);
  const fixT = current?.fixedCents ?? 0;
  const variable = current?.variableCents ?? 0;
  const total = fixT + variable;
  return (
    <div>
      <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="y2p-bars">
        {rows.map((row, i) => {
          const slot = rows.length ? 600 / rows.length : 100;
          const fh = (row.fixedCents / maxM) * 200;
          const vh = (row.variableCents / maxM) * 200;
          return (
            <g
              key={row.month}
              opacity={row.month === month ? 1 : 0.45}
              onClick={() => onPickMonth(row.month)}
              style={{ cursor: 'pointer' }}
            >
              <rect x={i * slot + slot * 0.18} y={200 - fh - vh} width={slot * 0.64} height={Math.max(0, vh - 3)} fill="#5F6266" />
              <rect x={i * slot + slot * 0.18} y={200 - fh} width={slot * 0.64} height={fh} fill="#E6E8EA" />
            </g>
          );
        })}
      </svg>
      <div className="y2p-bar-labels">
        {rows.map((row) => (
          <button key={row.month} type="button" onClick={() => onPickMonth(row.month)} style={{ fontSize: 13, color: '#9A9DA1' }}>
            {short(row.month)}
          </button>
        ))}
      </div>
      <div className="y2p-minis">
        <div className="y2p-mini">
          <div className="y2p-mini-l">
            <span className="y2p-sq" style={{ background: '#E6E8EA' }} />
            Fixos no mês
          </div>
          <div className="y2p-mono y2p-mini-v">{brl0(reais(fixT))}</div>
        </div>
        <div className="y2p-mini">
          <div className="y2p-mini-l">
            <span className="y2p-sq" style={{ background: '#5F6266' }} />
            Variáveis no mês
          </div>
          <div className="y2p-mono y2p-mini-v">{brl0(reais(variable))}</div>
        </div>
        <div className="y2p-mini">
          <div className="y2p-mini-l">Parte fixa do gasto</div>
          <div className="y2p-mono y2p-mini-v">{total ? Math.round((fixT / total) * 100) : 0}%</div>
        </div>
      </div>
    </div>
  );
}
