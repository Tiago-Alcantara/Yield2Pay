'use client';

import React, { useEffect, useRef, useState } from 'react';
import { C, CHROME_SHADOW, cardLabel } from '../_lib/familyTheme';
import { numericOnly, parseBRL } from '../_lib/familyFormat';
import { useFamily } from '../_lib/FamilyProvider';

/** Payload PIX de exemplo — trocado pelo BR Code real quando o backend existir. */
const PIX_CODE = '00020126580014br.gov.bcb.pix…';

/**
 * Card de depósito por PIX.
 *
 * É a mesma tela no fim do onboarding e no "Depositar por PIX" do painel; a
 * diferença é só o título e o botão de voltar (`fromApp`).
 */
export function PixDepositCard({
  fromApp = false,
  onConfirm,
  onBack,
}: {
  fromApp?: boolean;
  /** Recebe o valor digitado em R$ (0 quando o campo fica vazio). */
  onConfirm: (amount: number) => void;
  onBack?: () => void;
}) {
  const { t } = useFamily();
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  function handleCopy() {
    void navigator.clipboard?.writeText(PIX_CODE).catch(() => {
      /* clipboard bloqueado: o código continua visível na tela */
    });
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 420,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        padding: 'var(--fam-card-pad-lg)',
        boxShadow: '0 24px 56px rgba(0,0,0,.5)',
      }}
    >
      <h1
        style={{
          fontSize: 'clamp(22px,5.6vw,26px)',
          fontWeight: 700,
          letterSpacing: '-.02em',
          margin: 0,
          color: C.textStrong,
          textWrap: 'balance',
        }}
      >
        {fromApp ? t.onboarding.pixTitle : t.onboarding.pixFirstTitle}
      </h1>
      <p style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text2, margin: '10px 0 0' }}>
        {t.onboarding.pixSub}
      </p>

      <label htmlFor="fam-pix-valor" style={{ ...cardLabel, display: 'block', margin: '22px 0 8px' }}>
        {t.onboarding.pixAmountLabel}
      </label>
      <input
        id="fam-pix-valor"
        className="fam-field"
        type="text"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(numericOnly(e.target.value))}
        placeholder={t.onboarding.pixAmountPlaceholder}
        style={{
          width: '100%',
          background: C.well,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: '13px 14px',
          color: C.textStrong,
          fontFamily: C.mono,
          fontSize: 16,
          outline: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginTop: 18,
          background: C.well,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 86,
            height: 86,
            flexShrink: 0,
            borderRadius: 10,
            border: `1px solid ${C.borderStrong}`,
            background:
              'repeating-linear-gradient(0deg,#26282c 0,#26282c 6px,#1b1d21 6px,#1b1d21 12px),repeating-linear-gradient(90deg,#26282c 0,#26282c 6px,#1b1d21 6px,#1b1d21 12px)',
            backgroundBlendMode: 'overlay',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontFamily: C.mono, fontSize: 10, letterSpacing: '.1em', color: C.text2 }}>
            {t.onboarding.pixQr}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={cardLabel}>{t.onboarding.pixCopyLabel}</div>
          <div
            style={{
              fontFamily: C.mono,
              fontSize: 12,
              color: C.silver,
              marginTop: 6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {PIX_CODE}
          </div>
          <button
            type="button"
            className="fam-outline"
            onClick={handleCopy}
            style={{
              fontFamily: C.mono,
              fontSize: 12,
              fontWeight: 600,
              color: C.textStrong,
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${C.borderMetal}`,
              borderRadius: 999,
              padding: '6px 14px',
              cursor: 'pointer',
              marginTop: 10,
              transition: 'border-color .2s ease',
            }}
          >
            {copied ? t.onboarding.pixCopied : t.onboarding.pixCopy}
          </button>
        </div>
      </div>

      <button
        type="button"
        className="btn-shine"
        onClick={() => onConfirm(parseBRL(amount))}
        style={{
          width: '100%',
          fontFamily: 'inherit',
          fontSize: 15,
          fontWeight: 600,
          color: C.chromeInk,
          background: C.chromeSoft,
          border: 'none',
          borderRadius: 12,
          padding: 14,
          cursor: 'pointer',
          marginTop: 20,
          boxShadow: CHROME_SHADOW,
        }}
      >
        {t.onboarding.pixConfirm}
      </button>

      {fromApp && onBack && (
        <button
          type="button"
          className="fam-quiet"
          onClick={onBack}
          style={{
            width: '100%',
            fontFamily: 'inherit',
            fontSize: 14,
            color: C.text2,
            background: 'none',
            border: 'none',
            padding: '12px 0 0',
            cursor: 'pointer',
          }}
        >
          {t.onboarding.pixBack}
        </button>
      )}
    </div>
  );
}
