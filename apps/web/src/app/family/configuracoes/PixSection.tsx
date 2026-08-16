'use client';

import React, { useEffect, useRef, useState } from 'react';
import { C, cardLabel } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { isValidPixKey, numericOnly } from '../_lib/familyFormat';
import { FamilySwitch, GhostPill, PillGroup } from '../_components/FamilyUI';

/**
 * PIX e pagamentos: chave de saque (troca em dois passos), depósito automático
 * e o cartão virtual, ainda "em breve".
 */
export function PixSection() {
  const { t, state, patch } = useFamily();
  const [mode, setMode] = useState<'idle' | 'editing' | 'confirming'>('idle');
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updated, setUpdated] = useState(false);

  const [autoAmount, setAutoAmount] = useState(state.autoDeposit.amount);
  const [autoStatus, setAutoStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function confirmKey() {
    setSaving(true);
    timers.current.push(
      setTimeout(() => {
        patch({ pixKey: draft.trim() });
        setSaving(false);
        setMode('idle');
        setUpdated(true);
        timers.current.push(setTimeout(() => setUpdated(false), 2400));
      }, 700),
    );
  }

  function saveAuto() {
    setAutoStatus('saving');
    timers.current.push(
      setTimeout(() => {
        patch({ autoDeposit: { ...state.autoDeposit, amount: autoAmount } });
        setAutoStatus('saved');
        timers.current.push(setTimeout(() => setAutoStatus('idle'), 2200));
      }, 700),
    );
  }

  const smallChrome: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    color: C.chromeInk,
    background: C.chromeSoft,
    border: 'none',
    borderRadius: 12,
    padding: '11px 20px',
    cursor: 'pointer',
    boxShadow: '0 1px 0 rgba(255,255,255,.5) inset',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Chave PIX ─────────────────────────────────────────────────────── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 26 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.textStrong, letterSpacing: '-.01em' }}>
          {t.settings.pixTitle}
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.text2, margin: '8px 0 0', maxWidth: 520 }}>
          {t.settings.pixSub}
        </p>

        {mode === 'idle' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <span
              style={{
                background: C.well,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '12px 16px',
                fontFamily: C.mono,
                fontSize: 14,
                color: C.textStrong,
              }}
            >
              {state.pixKey}
            </span>
            <GhostPill
              mono={false}
              style={{ fontSize: 13.5 }}
              onClick={() => {
                setMode('editing');
                setDraft('');
                setInvalid(false);
                setUpdated(false);
              }}
            >
              {t.settings.pixChange}
            </GhostPill>
            {updated && <span style={{ fontSize: 13, color: C.silver }}>{t.settings.pixUpdated}</span>}
          </div>
        )}

        {mode === 'editing' && (
          <div style={{ marginTop: 16, maxWidth: 480 }}>
            <input
              className="fam-field"
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setInvalid(false);
              }}
              placeholder={t.settings.pixPlaceholder}
              aria-label={t.settings.pixAria}
              aria-invalid={invalid}
              style={{
                width: '100%',
                background: C.well,
                border: `1px solid ${invalid ? C.inputError : C.border}`,
                borderRadius: 12,
                padding: '12px 14px',
                color: C.textStrong,
                fontFamily: C.mono,
                fontSize: 14,
                outline: 'none',
              }}
            />
            {invalid && (
              <div role="alert" style={{ fontSize: 12.5, color: C.danger, marginTop: 8 }}>
                {t.settings.pixInvalid}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                style={smallChrome}
                onClick={() => {
                  if (isValidPixKey(draft)) {
                    setMode('confirming');
                    setInvalid(false);
                  } else {
                    setInvalid(true);
                  }
                }}
              >
                {t.settings.pixContinue}
              </button>
              <button
                type="button"
                className="fam-quiet"
                onClick={() => {
                  setMode('idle');
                  setInvalid(false);
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
                {t.settings.pixCancel}
              </button>
            </div>
          </div>
        )}

        {mode === 'confirming' && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: C.well,
              border: `1px solid ${C.borderMetal}`,
              borderRadius: 14,
              maxWidth: 480,
            }}
          >
            <div style={{ fontSize: 14, color: C.text }}>
              {t.settings.pixConfirmQuestion}{' '}
              <span style={{ fontFamily: C.mono, color: C.textStrong }}>{draft.trim()}</span>?
            </div>
            <div style={{ fontSize: 12.5, color: C.text3, marginTop: 4 }}>
              {t.settings.pixConfirmStep}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="button" style={smallChrome} onClick={confirmKey} disabled={saving}>
                {saving ? t.settings.pixConfirmSaving : t.settings.pixConfirmYes}
              </button>
              <button
                type="button"
                className="fam-quiet"
                onClick={() => setMode('editing')}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: C.text2,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t.settings.pixBack}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Depósito automático ───────────────────────────────────────────── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 220 }}>
            <span
              style={{
                display: 'block',
                fontSize: 18,
                fontWeight: 700,
                color: C.textStrong,
                letterSpacing: '-.01em',
              }}
            >
              {t.settings.autoTitle}
            </span>
            <span style={{ display: 'block', fontSize: 13.5, color: C.text2, marginTop: 4 }}>
              {t.settings.autoSub}
            </span>
          </span>
          <FamilySwitch
            checked={state.autoDeposit.on}
            onChange={() => patch({ autoDeposit: { ...state.autoDeposit, on: !state.autoDeposit.on } })}
            aria-label={t.settings.autoTitle}
          />
        </div>

        {state.autoDeposit.on && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 18,
              alignItems: 'flex-end',
            }}
          >
            <div>
              <label htmlFor="cfg-auto-v" style={{ ...cardLabel, display: 'block', marginBottom: 8 }}>
                {t.settings.autoAmount}
              </label>
              <input
                id="cfg-auto-v"
                className="fam-field"
                type="text"
                inputMode="numeric"
                value={autoAmount}
                onChange={(e) => setAutoAmount(numericOnly(e.target.value))}
                style={{
                  width: 140,
                  background: C.well,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  color: C.textStrong,
                  fontFamily: C.mono,
                  fontSize: 14.5,
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <div style={{ ...cardLabel, marginBottom: 8 }}>{t.settings.autoFreq}</div>
              <PillGroup
                ariaLabel={t.settings.autoFreq}
                options={t.settings.autoFreqs.map(([value, label]) => ({ value, label }))}
                value={state.autoDeposit.freq}
                onChange={(freq) => patch({ autoDeposit: { ...state.autoDeposit, freq } })}
              />
            </div>
            <button
              type="button"
              style={{ ...smallChrome, padding: '12px 20px' }}
              onClick={saveAuto}
              disabled={autoStatus === 'saving'}
            >
              {autoStatus === 'saving' ? t.settings.saving : t.settings.autoSave}
            </button>
            {autoStatus === 'saved' && (
              <span style={{ fontSize: 13, color: C.silver, paddingBottom: 12 }}>
                {t.settings.autoSaved}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Cartão virtual ────────────────────────────────────────────────── */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          padding: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <span>
          <span
            style={{
              display: 'block',
              fontSize: 18,
              fontWeight: 700,
              color: C.textStrong,
              letterSpacing: '-.01em',
            }}
          >
            {t.settings.cardTitle}
          </span>
          <span style={{ display: 'block', fontSize: 13.5, color: C.text2, marginTop: 4 }}>
            {t.settings.cardSub}
          </span>
        </span>
        <span
          style={{
            fontFamily: C.mono,
            fontSize: 10.5,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: C.text2,
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            padding: '6px 14px',
          }}
        >
          {t.settings.cardSoon}
        </span>
      </div>
    </div>
  );
}
