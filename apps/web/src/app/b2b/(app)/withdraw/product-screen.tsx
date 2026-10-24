'use client';

import React, { useState } from 'react';
import { MetalCard } from '@/components/MetalCard';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Badge } from '@/components/Badge';
import { BrandHeader } from '@/components/BrandHeader';
import { TxErrorBox } from '@/components/TxErrorBox';
import { useWithdrawFlow } from '@/lib/useWithdrawFlow';
import { useIsMobile } from '@/lib/useIsMobile';

// Câmbio aproximado USDC→BRL (sandbox ~5.34). Só p/ projeção na UI.
const USDC_TO_BRL = 5.34;

function fmtBrl(n: number): string {
  return 'R$' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtUsd(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

const CHIPS = [10, 50, 100];

export default function WithdrawPage() {
  const isMobile = useIsMobile();
  const { state, order, error, start } = useWithdrawFlow();

  const [amount, setAmount] = useState('50');
  const amountNum = parseFloat(amount) || 0;
  const approxBrl = amountNum * USDC_TO_BRL;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? '24px 12px' : '48px 24px' }}>
      <div style={{ width: 520, maxWidth: '100%' }}>
        <BrandHeader />

        <MetalCard sweep="loop" padding={0} radius="var(--fx-radius-2xl)" style={{ border: '1px solid var(--fx-border-metal)', boxShadow: 'var(--fx-elev-hero)' }}>
          <div style={{ padding: 30 }}>

            {(state === 'idle') && (
              <>
                <h2 style={{ fontFamily: 'var(--fx-font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--fx-text)', margin: 0, textShadow: 'var(--fx-emboss)' }}>
                  Sacar via Pix
                </h2>
                <p style={{ color: 'var(--fx-text-2)', fontSize: 14.5, margin: '8px 0 0', lineHeight: 1.55 }}>
                  Retire do seu cofre e receba em BRL na sua conta, via Pix.
                </p>

                <div style={{ marginTop: 20 }}>
                  <Input label="Valor a sacar" prefix="$" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {CHIPS.map((a) => (
                    <span key={a} onClick={() => setAmount(String(a))} style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 13, color: amountNum === a ? 'var(--fx-text)' : 'var(--fx-text-2)', background: 'var(--fx-surface-2)', border: `1px solid ${amountNum === a ? 'var(--fx-silver)' : 'var(--fx-border)'}`, borderRadius: 'var(--fx-radius-pill)', padding: '8px 14px', cursor: 'pointer' }}>
                      {fmtUsd(a)}
                    </span>
                  ))}
                </div>

                <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--fx-surface-2)', borderRadius: 'var(--fx-radius-md)', border: '1px solid var(--fx-border)' }}>
                  <div style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fx-text-3)', marginBottom: 6 }}>Você recebe (aprox.)</div>
                  <div style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 24, color: 'var(--fx-text-strong)' }}>~{fmtBrl(approxBrl)}</div>
                  <div style={{ fontSize: 12, color: 'var(--fx-text-3)', marginTop: 4 }}>Via Pix · câmbio ≈ R$5,34 / USDC</div>
                </div>

                {error && <TxErrorBox message={error} />}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 26 }}>
                  <Button onClick={() => start(amount)} disabled={amountNum <= 0}>Sacar</Button>
                </div>
              </>
            )}

            {state === 'processing' && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 34, marginBottom: 14 }}>⏳</div>
                <div style={{ fontFamily: 'var(--fx-font-display)', fontSize: 20, fontWeight: 700, color: 'var(--fx-text)' }}>
                  Processando seu saque…
                </div>
                <p style={{ color: 'var(--fx-text-2)', fontSize: 13.5, marginTop: 8 }}>Enviando o Pix. Isso leva alguns segundos.</p>
              </div>
            )}

            {state === 'done' && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>✓</div>
                <div style={{ fontFamily: 'var(--fx-font-display)', fontSize: 24, fontWeight: 700, color: 'var(--fx-text)', marginBottom: 8 }}>
                  Saque enviado!
                </div>
                <p style={{ color: 'var(--fx-text-2)', fontSize: 14 }}>
                  ~{order ? fmtBrl(parseFloat(order.targetAmount)) : fmtBrl(approxBrl)} a caminho da sua conta via Pix.
                </p>
                <div style={{ marginTop: 24 }}><Badge dot>BRL a caminho via Pix</Badge></div>
              </div>
            )}

            {state === 'error' && (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ fontFamily: 'var(--fx-font-display)', fontSize: 20, fontWeight: 700, color: 'var(--fx-text)', marginBottom: 10 }}>
                  Não deu pra concluir
                </div>
                {error && <TxErrorBox message={error} />}
                <div style={{ marginTop: 16 }}>
                  <Button onClick={() => start(amount)}>Tentar de novo</Button>
                </div>
              </div>
            )}
          </div>
        </MetalCard>
      </div>
    </div>
  );
}
