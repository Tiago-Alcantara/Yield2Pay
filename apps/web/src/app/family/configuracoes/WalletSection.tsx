'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { C } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { fmtBRL } from '../_lib/familyFormat';
import { GhostPill } from '../_components/FamilyUI';

type MovKind = 'entrada' | 'saida' | 'pagamento';

/** Carteira: endereço, extrato e exportações. Extrato ainda é exemplo fixo. */
export function WalletSection() {
  const { t, state } = useFamily();
  const [filter, setFilter] = useState<'todos' | MovKind>('todos');
  const [copied, setCopied] = useState(false);
  const [csvDone, setCsvDone] = useState(false);
  const [pdfDone, setPdfDone] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function flash(set: (v: boolean) => void, ms = 2000) {
    set(true);
    timers.current.push(setTimeout(() => set(false), ms));
  }

  const history = useMemo(
    () => [
      { id: 'h1', kind: 'pagamento' as MovKind, label: 'Netflix', sub: `05/08 · ${t.dash.movAuto}`, v: -59.9 },
      { id: 'h2', kind: 'entrada' as MovKind, label: t.dash.movYield, sub: `01/08 · ${t.dash.movYieldSub}`, v: 198.4 },
      { id: 'h3', kind: 'pagamento' as MovKind, label: 'Spotify', sub: `08/07 · ${t.dash.movAuto}`, v: -34.9 },
      { id: 'h4', kind: 'saida' as MovKind, label: t.settings.histWithdraw, sub: `22/06 · ${t.settings.histWithdrawSub}`, v: -1200 },
      { id: 'h5', kind: 'entrada' as MovKind, label: t.dash.movDeposit, sub: `10/06 · ${t.dash.movDepositSub}`, v: 30000 },
    ],
    [t],
  );

  const rows = history.filter((h) => filter === 'todos' || h.kind === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 26 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.textStrong, letterSpacing: '-.01em' }}>
          {t.settings.walletTitle}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <span
            style={{
              background: C.well,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '12px 16px',
              fontFamily: C.mono,
              fontSize: 15,
              color: C.textStrong,
              letterSpacing: '.04em',
            }}
          >
            {state.walletAddress}
          </span>
          <GhostPill
            onClick={() => {
              void navigator.clipboard?.writeText(state.walletAddress).catch(() => {});
              flash(setCopied);
            }}
          >
            {copied ? t.settings.walletCopied : t.settings.walletCopy}
          </GhostPill>
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.text2, margin: '12px 0 0', maxWidth: 520 }}>
          {t.settings.walletNote}{' '}
          <Link href="/family/conceitos" style={{ color: C.silver }}>
            {t.settings.walletLink}
          </Link>
        </p>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 26 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: C.textStrong, letterSpacing: '-.01em' }}>
            {t.settings.historyTitle}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <GhostPill style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => flash(setCsvDone)}>
              {csvDone ? t.settings.exportCsvDone : t.settings.exportCsv}
            </GhostPill>
            <GhostPill style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => flash(setPdfDone)}>
              {pdfDone ? t.settings.exportPdfDone : t.settings.exportPdf}
            </GhostPill>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          {t.settings.filters.map(([id, label]) => {
            const on = filter === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(id as 'todos' | MovKind)}
                style={{
                  border: `1px solid ${on ? C.borderStrong : C.border}`,
                  borderRadius: 999,
                  padding: '7px 14px',
                  fontFamily: C.mono,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: on ? '#2E3136' : 'transparent',
                  color: on ? C.textStrong : C.text2,
                  transition: 'all .2s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {rows.length === 0 && (
            <div style={{ fontSize: 13.5, color: C.text3, padding: '16px 0' }}>
              {t.settings.historyEmpty}
            </div>
          )}
          {rows.map((h) => (
            <div
              key={h.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 0',
                borderBottom: `1px solid ${C.borderFainter}`,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>
                  {h.label}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: C.text3, marginTop: 2 }}>
                  {h.sub}
                </span>
              </span>
              <span
                style={{
                  fontFamily: C.mono,
                  fontSize: 13.5,
                  whiteSpace: 'nowrap',
                  color: h.v >= 0 ? C.textStrong : C.text2,
                }}
              >
                {h.v >= 0 ? '+ ' : '− '}
                {fmtBRL(Math.abs(h.v))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
