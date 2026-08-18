'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { C } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';

/**
 * Privacidade e dados: LGPD e exclusão de conta.
 *
 * A exclusão é deliberadamente barrada enquanto houver saldo — a conta guarda
 * dinheiro do usuário e apagá-la não sacaria nada por ele.
 */
export function PrivacySection() {
  const { t, state } = useFamily();
  const [downloaded, setDownloaded] = useState(false);
  const [step, setStep] = useState<0 | 1>(0);
  const [error, setError] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const hasBalance = state.deposit > 0;

  const cardTitle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    color: C.textStrong,
    letterSpacing: '-.01em',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 'var(--fam-card-pad)' }}>
        <div style={cardTitle}>{t.settings.dataTitle}</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.text2, margin: '8px 0 0', maxWidth: 540 }}>
          {t.settings.dataSub}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <button
            type="button"
            className="fam-outline"
            onClick={() => {
              setDownloaded(true);
              timers.current.push(setTimeout(() => setDownloaded(false), 2600));
            }}
            style={{
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              color: C.textStrong,
              background: 'rgba(255,255,255,.03)',
              border: `1px solid ${C.borderMetal}`,
              borderRadius: 12,
              padding: '12px 20px',
              cursor: 'pointer',
              transition: 'border-color .2s ease',
            }}
          >
            {downloaded ? t.settings.dataDownloadDone : t.settings.dataDownload}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 18 }}>
          <a href="#termos" style={{ fontSize: 13.5, color: C.silver }}>
            {t.settings.terms}
          </a>
          <a href="#privacidade" style={{ fontSize: 13.5, color: C.silver }}>
            {t.settings.privacy}
          </a>
        </div>
      </div>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.dangerEdge}`,
          borderRadius: 20,
          padding: 'var(--fam-card-pad)',
        }}
      >
        <div style={cardTitle}>{t.settings.deleteTitle}</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.text2, margin: '8px 0 0', maxWidth: 540 }}>
          {t.settings.deleteSub}
        </p>

        {step === 0 ? (
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setError(false);
            }}
            style={{
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              color: C.danger,
              background: 'none',
              border: `1px solid ${C.dangerBorder}`,
              borderRadius: 12,
              padding: '12px 20px',
              cursor: 'pointer',
              marginTop: 16,
              transition: 'border-color .2s ease',
            }}
          >
            {t.settings.deleteCta}
          </button>
        ) : (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: C.well,
              border: `1px solid ${C.dangerBorder}`,
              borderRadius: 14,
              maxWidth: 520,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.settings.deleteStep}</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: C.text2, margin: '6px 0 0' }}>
              {t.settings.deleteBody}
            </p>
            {error && (
              <div role="alert" style={{ fontSize: 12.5, color: C.danger, marginTop: 10 }}>
                {t.settings.deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setError(hasBalance)}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.danger,
                  background: 'none',
                  border: `1px solid ${C.dangerBorder}`,
                  borderRadius: 12,
                  padding: '11px 18px',
                  cursor: 'pointer',
                }}
              >
                {t.settings.deleteConfirm}
              </button>
              <Link
                href="/family/saque"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.textStrong,
                  background: 'rgba(255,255,255,.03)',
                  border: `1px solid ${C.borderMetal}`,
                  borderRadius: 12,
                  padding: '11px 18px',
                  display: 'inline-block',
                  textDecoration: 'none',
                }}
              >
                {t.settings.deleteWithdrawFirst}
              </Link>
              <button
                type="button"
                className="fam-quiet"
                onClick={() => {
                  setStep(0);
                  setError(false);
                }}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: C.text2,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t.settings.deleteCancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
