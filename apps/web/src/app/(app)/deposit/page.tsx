'use client';

import React, { useState } from 'react';
import { MetalCard } from '@/components/MetalCard';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Badge } from '@/components/Badge';
import { BrandHeader } from '@/components/BrandHeader';
import { TxErrorBox } from '@/components/TxErrorBox';
import { useDepositFlow } from '@/lib/useDepositFlow';

// Rendimento anual demonstrativo (mesma base do restante do app).
const ANNUAL_YIELD = 0.084;

function fmtBrl(n: number): string {
  return 'R$' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0' }}>
      <span style={{ color: 'var(--fx-text-2)', fontSize: 14 }}>{label}</span>
      <span style={{ fontFamily: 'var(--fx-font-mono)', color: 'var(--fx-text)' }}>{value}</span>
    </div>
  );
}
function Divider() {
  return <div style={{ height: 1, background: 'var(--fx-border)' }} />;
}

const CHIPS = [100, 250, 500];

export default function DepositPage() {
  const { state, order, error, start, simulate, confirm } = useDepositFlow();

  const [amountBrl, setAmountBrl] = useState('100');
  const amountNum = parseFloat(amountBrl) || 0;
  const monthly = (amountNum * ANNUAL_YIELD) / 12;

  const busy = state === 'quoting' || state === 'applying';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'clamp(20px, 4vw, 48px) clamp(12px, 3vw, 24px)' }}>
      <div style={{ width: 'min(520px, 100%)' }}>
        <BrandHeader />

        <MetalCard sweep="loop" padding={0} radius="var(--fx-radius-2xl)" style={{ border: '1px solid var(--fx-border-metal)', boxShadow: 'var(--fx-elev-hero)' }}>
          <div style={{ padding: 'clamp(16px, 5vw, 30px)' }}>

            {/* ── Valor ─────────────────────────────────────────────── */}
            {(state === 'idle' || state === 'quoting') && (
              <>
                <h2 style={{ fontFamily: 'var(--fx-font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--fx-text)', margin: 0, textShadow: 'var(--fx-emboss)' }}>
                  Quanto quer depositar?
                </h2>
                <p style={{ color: 'var(--fx-text-2)', fontSize: 14.5, margin: '8px 0 0', lineHeight: 1.55 }}>
                  Deposite via Pix. Seu dinheiro fica seu e rende — só o rendimento paga suas ferramentas.
                </p>

                <div style={{ marginTop: 20 }}>
                  <Input
                    label="Valor do depósito"
                    prefix="R$"
                    value={amountBrl}
                    onChange={(e) => setAmountBrl(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {CHIPS.map((a) => (
                    <span
                      key={a}
                      onClick={() => setAmountBrl(String(a))}
                      style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 13, color: amountNum === a ? 'var(--fx-text)' : 'var(--fx-text-2)', background: 'var(--fx-surface-2)', border: `1px solid ${amountNum === a ? 'var(--fx-silver)' : 'var(--fx-border)'}`, borderRadius: 'var(--fx-radius-pill)', padding: '8px 14px', cursor: 'pointer' }}
                    >
                      {fmtBrl(a).replace(',00', '')}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--fx-border)' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fx-text-3)' }}>Rende por mês</div>
                    <div style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 20, color: 'var(--fx-text-strong)', marginTop: 5 }}>
                      {fmtBrl(monthly)}<span style={{ fontSize: 13, color: 'var(--fx-silver)' }}> / mês</span>
                    </div>
                  </div>
                  <Badge dot>Capital continua seu</Badge>
                </div>

                {error && <TxErrorBox message={error} />}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 26 }}>
                  <Button onClick={() => start(amountBrl)} disabled={busy || amountNum <= 0}>
                    {state === 'quoting' ? 'Gerando Pix…' : 'Depositar'}
                  </Button>
                </div>
              </>
            )}

            {/* ── Pix (aguardando pagamento) ────────────────────────── */}
            {state === 'awaiting_pix' && order && (
              <>
                <h2 style={{ fontFamily: 'var(--fx-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--fx-text)', margin: '0 0 8px' }}>
                  Pague com Pix
                </h2>
                <p style={{ color: 'var(--fx-text-2)', fontSize: 14, margin: '0 0 20px', lineHeight: 1.55 }}>
                  Transfira {fmtBrl(amountNum)} via Pix. Assim que cair, aplicamos no seu cofre.
                </p>

                <Row label="Valor" value={fmtBrl(amountNum)} />
                <Divider />
                <Row label="Destino" value={order.depositBankName || 'Pix'} />
                <Divider />
                <Row label="Você recebe" value={`~${Number(order.targetAmount).toFixed(2)} no cofre`} />

                {error && <TxErrorBox message={error} />}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                  <Button onClick={() => simulate()}>▶ Simular Pix recebido</Button>
                </div>
              </>
            )}

            {/* ── Pix recebido → confirmar aplicação ────────────────── */}
            {state === 'funded' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>💸</div>
                <div style={{ fontFamily: 'var(--fx-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--fx-text)', marginBottom: 8 }}>
                  Pix recebido!
                </div>
                <p style={{ color: 'var(--fx-text-2)', fontSize: 14, margin: '0 auto 20px', maxWidth: 360, lineHeight: 1.55 }}>
                  Confirme pra aplicar o valor no seu cofre e começar a render.
                </p>
                {error && <TxErrorBox message={error} />}
                <Button onClick={() => confirm()}>Confirmar depósito</Button>
              </div>
            )}

            {/* ── Aplicando (claim + depósito escondidos) ───────────── */}
            {state === 'applying' && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 34, marginBottom: 14 }}>⏳</div>
                <div style={{ fontFamily: 'var(--fx-font-display)', fontSize: 20, fontWeight: 700, color: 'var(--fx-text)' }}>
                  Aplicando no seu cofre…
                </div>
                <p style={{ color: 'var(--fx-text-2)', fontSize: 13.5, marginTop: 8 }}>
                  Isso leva alguns segundos.
                </p>
              </div>
            )}

            {/* ── Sucesso ───────────────────────────────────────────── */}
            {state === 'done' && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>✓</div>
                <div style={{ fontFamily: 'var(--fx-font-display)', fontSize: 24, fontWeight: 700, color: 'var(--fx-text)', marginBottom: 8 }}>
                  Seu dinheiro está rendendo
                </div>
                <p style={{ color: 'var(--fx-text-2)', fontSize: 14 }}>
                  {fmtBrl(amountNum)} aplicados. O rendimento já cobre suas ferramentas.
                </p>
                <div style={{ marginTop: 24 }}>
                  <Badge dot>Capital trabalhando por você</Badge>
                </div>
              </div>
            )}

            {/* ── Erro fatal (fora dos fluxos) ──────────────────────── */}
            {state === 'error' && (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ fontFamily: 'var(--fx-font-display)', fontSize: 20, fontWeight: 700, color: 'var(--fx-text)', marginBottom: 10 }}>
                  Não deu pra concluir
                </div>
                {error && <TxErrorBox message={error} />}
                <div style={{ marginTop: 16 }}>
                  <Button onClick={() => start(amountBrl)}>Tentar de novo</Button>
                </div>
              </div>
            )}
          </div>
        </MetalCard>
      </div>
    </div>
  );
}
