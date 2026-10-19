import { useState, type ReactNode } from 'react';
import type { HouseholdSummary } from '@yield2pay/shared';
import {
  CRIPTO,
  METAS,
  PESSOAS,
  SENTIDOS,
  brl0,
  freedomPhrase,
  metaLabel,
  nf,
  reais,
  type PainelDraft,
} from './painel-format';

export function Onboarding({
  initial,
  summary,
  onSkip,
  onSave,
  onFinish,
}: {
  initial: PainelDraft;
  summary: HouseholdSummary;
  onSkip: () => void;
  onSave: (draft: PainelDraft) => Promise<void>;
  onFinish: () => void;
}) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState<PainelDraft>({ ...initial });
  const set = (p: Partial<PainelDraft>) => setD((s) => ({ ...s, ...p }));
  const canNext = [d.pessoas != null, true, true, d.cripto != null][step];
  const freedom = summary.freedom;

  async function continueStep() {
    if (!canNext || saving) return;
    if (step === 3) {
      setSaving(true);
      try {
        await onSave(d);
        setStep(4);
      } catch {
        return;
      } finally {
        setSaving(false);
      }
      return;
    }
    setStep(step + 1);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Boas-vindas" className="y2p-overlay" data-screen-label="Onboarding">
      <div className="y2p-modal">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="y2p-progress">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={i <= step ? 'is-on' : ''} />
            ))}
          </div>
          <button type="button" className="y2p-link" onClick={onSkip}>
            Pular por agora
          </button>
        </div>

        {step === 0 && (
          <Step
            kicker="Sua família · 1 de 4"
            title="Quantas pessoas vivem da renda da casa?"
            sub="Assim calculamos a liberdade financeira da família inteira, não só a sua."
          >
            <div className="y2p-opt-grid">
              {PESSOAS.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={d.pessoas === l}
                  className={'y2p-opt' + (d.pessoas === l ? ' is-on' : '')}
                  onClick={() => set({ pessoas: l })}
                >
                  {l}
                </button>
              ))}
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step
            kicker="Dinheiro · 2 de 4"
            title="Quanto entra e quanto já está guardado?"
            sub="Um valor aproximado basta. Só você vê esses números."
          >
            <Range label="Renda mensal da família" value={d.renda} min={2000} max={50000} step={500} onChange={(v) => set({ renda: v })} />
            <Range label="Reserva guardada hoje" value={d.reserva} min={0} max={300000} step={1000} onChange={(v) => set({ reserva: v })} />
          </Step>
        )}

        {step === 2 && (
          <Step kicker="Liberdade · 3 de 4" title="O que liberdade financeira significa para vocês?" sub="Escolha quantas quiser.">
            <div className="y2p-chips">
              {SENTIDOS.map((l) => {
                const on = d.sentidos.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={on}
                    className={'y2p-chip y2p-chip--lg' + (on ? ' is-on' : '')}
                    onClick={() => set({ sentidos: on ? d.sentidos.filter((s) => s !== l) : [...d.sentidos, l] })}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
            <div className="y2p-hr" />
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>Quanto tempo de liberdade é a meta?</div>
              <div style={{ fontSize: 14.5, color: '#9A9DA1', marginTop: 4 }}>Tempo que a família se mantém sem nenhuma renda.</div>
              <div className="y2p-seg y2p-seg--full" style={{ marginTop: 14 }}>
                {METAS.map(([m, l]) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={d.meta === m}
                    className={d.meta === m ? 'is-on' : ''}
                    onClick={() => set({ meta: m })}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step
            kicker="Aprender · 4 de 4"
            title="Você teria interesse em aprender sobre cripto para conquistar essa liberdade?"
            sub="Sem promessa de ganho fácil. Conteúdo claro para decidir com calma."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CRIPTO.map(([k, t, s]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={d.cripto === k}
                  className={'y2p-opt y2p-opt--tall' + (d.cripto === k ? ' is-on' : '')}
                  onClick={() => set({ cripto: k })}
                >
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{t}</div>
                  <div className="y2p-opt-desc">{s}</div>
                </button>
              ))}
            </div>
          </Step>
        )}

        {step === 4 && (
          <div className="y2p-step">
            <div>
              <div className="y2p-kicker">Seu ponto de partida</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <span className="y2p-mono" style={{ fontSize: 'clamp(48px,7vw,64px)', fontWeight: 600, color: '#F2F3F4', letterSpacing: '-.02em' }}>
                  {freedom ? nf(freedom.months, 1) : '—'}
                </span>
                <span style={{ fontSize: 20, fontWeight: 600 }}>meses de liberdade</span>
              </div>
              <p className="y2p-p">
                Com o gasto médio de {brl0(reais(summary.averageCents))} que você importou, é o tempo que a reserva sustenta a casa hoje.
              </p>
            </div>
            <div className="y2p-box">
              <div className="y2p-kv">
                <span>Meta</span>
                <span className="y2p-mono">{metaLabel(d.meta)}</span>
              </div>
              <div className="y2p-kv">
                <span>Faltam</span>
                <span className="y2p-mono">{freedom ? brl0(reais(Math.max(0, freedom.missingCents))) : '—'}</span>
              </div>
              <div className="y2p-hr" />
              <div style={{ fontSize: 15, lineHeight: 1.5, fontWeight: 500 }}>{freedomPhrase(freedom)}</div>
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.5, color: '#C0C2C5' }}>
              {d.cripto === 'nao'
                ? 'Sem cripto por enquanto. A trilha fica guardada para quando quiser.'
                : d.cripto === 'fundo'
                  ? 'Separamos uma trilha de cripto para ir além do básico.'
                  : 'Separamos uma trilha de cripto para começar do zero, sem pressa.'}
            </div>
            <button type="button" className="y2p-chrome y2p-btn-xl" onClick={onFinish}>
              Ver meu painel
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {step > 0 && (
            <button type="button" className="y2p-ghost y2p-btn-md" onClick={() => setStep(step - 1)}>
              Voltar
            </button>
          )}
          <span style={{ flex: 1 }} />
          {step < 4 && (
            <button type="button" className="y2p-chrome y2p-btn-md" disabled={!canNext || saving} onClick={() => void continueStep()}>
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ kicker, title, sub, children }: { kicker: string; title: string; sub: string; children: ReactNode }) {
  return (
    <div className="y2p-step">
      <div>
        <div className="y2p-kicker">{kicker}</div>
        <h2 className="y2p-h2">{title}</h2>
        <p className="y2p-p" style={{ color: '#9A9DA1' }}>
          {sub}
        </p>
      </div>
      {children}
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="y2p-box">
      <div className="y2p-kv" style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, color: '#C0C2C5' }}>{label}</span>
        <span className="y2p-mono" style={{ fontSize: 24, fontWeight: 600, color: '#F2F3F4' }}>
          {brl0(value)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} aria-label={label} />
    </div>
  );
}
