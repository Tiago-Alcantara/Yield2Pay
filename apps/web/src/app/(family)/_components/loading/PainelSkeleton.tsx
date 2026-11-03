'use client';

/* Skeleton do conteúdo de #s-topo no /dashboard. Usa as mesmas classes do
   PainelGastos (y2p-top, y2p-stats, y2p-card-plain, y2p-tx), então herda grades,
   paddings, raios, cores de tema e o layout do celular de painel.css, e a troca
   skeleton → conteúdo não faz a página pular.
   Regra: só desenha o que aparece para toda conta. O convite depende do papel na
   casa, e os blocos abaixo da lista não entram: skeleton não promete conteúdo.
   Nenhum bloco leva os ids das seções: as âncoras ficam só no conteúdo real. */

import { MetalCard } from '@/components/MetalCard';
import { Sk, SkLines } from './Skeleton';

const BARS = [42, 58, 50, 66, 74, 60, 80, 88, 70, 92, 84, 96];
const ROWS = [62, 48, 70, 54, 44, 58];
const CHIPS = [64, 88, 76, 92, 70];

export function PainelSkeleton({ liberdadeOn }: { liberdadeOn: boolean }) {
  return (
    <>
      <span className="y2p-ld-sr" role="status" aria-live="polite">Carregando seus gastos…</span>

      {/* 1 · total do mês + liberdade */}
      <div className={'y2p-top' + (liberdadeOn ? '' : ' is-single')}>
        <div className="y2p-card-plain y2p-spend">
          <Sk w="38%" h={12} style={{ margin: '2px 0' }} />
          <Sk w="58%" h={44} style={{ marginTop: 12 }} />
          <Sk w="44%" h={12} style={{ margin: '12px 0 4px' }} />
          <div style={{ marginTop: 'auto', paddingTop: 24 }}>
            <Sk w={132} h={38} r={12} />
          </div>
        </div>
        {liberdadeOn && (
          <MetalCard padding={24} radius="16px" sweep="none">
            <div className="y2p-lib-card y2p-ld-on-metal">
              <div className="y2p-lib-row">
                <Sk w={84} h={12} style={{ margin: '2px 0' }} />
                <Sk w={96} h={12} style={{ margin: '2px 0' }} />
              </div>
              <Sk w="34%" h={44} />
              <SkLines widths={['86%', '52%']} h={12} />
              <div>
                <Sk w="100%" h={8} r={2} />
                <Sk w="100%" h={12} style={{ marginTop: 10 }} />
              </div>
            </div>
          </MetalCard>
        )}
      </div>

      {/* 2 · três indicadores (StatCard) */}
      <div className="y2p-stats">
        {[0, 1, 2].map((i) => (
          <div key={i} className={'y2p-stat' + (i === 2 ? ' y2p-stat--wide' : '')}>
            <Sk w="42%" h={12} style={{ margin: '2px 0' }} />
            <Sk w="70%" h={32} style={{ marginTop: 12 }} />
            <Sk w="60%" h={12} style={{ margin: '12px 0 4px' }} />
            <Sk w="34%" h={12} style={{ margin: '6px 0 2px' }} />
          </div>
        ))}
      </div>

      {/* 3 · gráfico */}
      <div className="y2p-card-plain">
        <div className="y2p-charts">
          <div className="y2p-charts-head">
            <Sk w={200} h={16} />
            <Sk w={200} h={32} shape="pill" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 220 }}>
            {BARS.map((h, i) => (
              <Sk key={i} w="auto" h={h + '%'} r="4px 4px 2px 2px" style={{ flex: 1 }} />
            ))}
          </div>
        </div>
      </div>

      {/* 4 · lista de gastos */}
      <div className="y2p-section">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Sk w={220} h={22} style={{ margin: '3px 0' }} />
            <Sk w={160} h={14} style={{ marginTop: 7 }} />
          </div>
          <div className="y2p-chips">
            {CHIPS.map((w, i) => (
              <Sk key={i} w={w} h={32} r={8} />
            ))}
          </div>
        </div>
        <div className="y2p-list y2p-card-plain">
          {ROWS.map((w, i) => (
            <div key={i} className="y2p-tx">
              <Sk w={38} h={12} />
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Sk w={w + '%'} h={12} />
                <Sk w={w / 2 + '%'} h={10} />
              </span>
              <Sk w={110} h={30} r={8} className="y2p-ld-tx-cat" />
              <Sk w={96} h={12} />
              <Sk w={32} h={32} r={8} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
