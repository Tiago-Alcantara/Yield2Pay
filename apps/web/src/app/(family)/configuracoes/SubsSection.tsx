'use client';

import React, { useState } from 'react';
import { C, cardLabel } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { fmtBRL, numericOnly, parseBRL } from '../_lib/familyFormat';
import { coverageRows } from '../_lib/familyMath';
import { StatusPill } from '../_components/FamilyUI';

/** Assinaturas: prioridade (ordem), valor, vencimento e remoção. */
export function SubsSection() {
  const { t, state, moveSub, updateSub, removeSub } = useFamily();
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDay, setEditDay] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const rows = coverageRows(state.subs, state.deposit, state.rate);

  function startEdit(id: string, price: number, dia: number) {
    setEditing(id);
    setEditValue(String(price).replace('.', ','));
    setEditDay(String(dia));
    setConfirmRemove(null);
  }

  function saveEdit(id: string, fallbackDay: number) {
    const price = parseBRL(editValue);
    if (price <= 0) return;
    const dia = Math.min(28, Math.max(1, parseInt(editDay, 10) || fallbackDay));
    updateSub(id, { price, dia });
    setEditing(null);
  }

  function handleRemove(id: string) {
    if (confirmRemove !== id) {
      setConfirmRemove(id);
      return;
    }
    removeSub(id);
    setConfirmRemove(null);
  }

  const arrow = (enabled: boolean): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    cursor: enabled ? 'pointer' : 'default',
    color: enabled ? C.text2 : C.borderStrong,
    fontSize: 10,
    padding: '1px 4px',
    lineHeight: 1,
  });

  const miniInput: React.CSSProperties = {
    background: C.wellDeep,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    color: C.textStrong,
    fontFamily: C.mono,
    fontSize: 14,
    outline: 'none',
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 'var(--fam-card-pad)' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.textStrong, letterSpacing: '-.01em' }}>
        {t.settings.subsTitle}
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.text2, margin: '8px 0 0', maxWidth: 540 }}>
        {t.settings.subsSub}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
        {rows.map((row, i) => (
          <div key={row.id} style={{ borderBottom: `1px solid ${C.borderFainter}`, padding: '14px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button
                  type="button"
                  aria-label={t.settings.subsUp}
                  disabled={i === 0}
                  onClick={() => moveSub(row.id, -1)}
                  style={arrow(i > 0)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={t.settings.subsDown}
                  disabled={i === rows.length - 1}
                  onClick={() => moveSub(row.id, 1)}
                  style={arrow(i < rows.length - 1)}
                >
                  ▼
                </button>
              </span>

              <span style={{ flex: 1, minWidth: 160 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: C.textStrong }}>
                  {row.name}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: C.text3, marginTop: 2 }}>
                  {t.settings.subsDue(String(row.dia))}
                </span>
              </span>

              <span style={{ fontFamily: C.mono, fontSize: 14, color: C.silver }}>
                {fmtBRL(row.price)}
              </span>
              <StatusPill covered={row.covered}>
                {row.covered ? t.settings.statusCovered : t.settings.statusNotYet}
              </StatusPill>

              <button
                type="button"
                className="fam-quiet"
                onClick={() => startEdit(row.id, row.price, row.dia)}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: C.text2,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 6,
                }}
              >
                {t.settings.subsEdit}
              </button>
              <button
                type="button"
                onClick={() => handleRemove(row.id)}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: confirmRemove === row.id ? 600 : 400,
                  color: C.danger,
                  background: 'none',
                  border: confirmRemove === row.id ? `1px solid ${C.dangerBorder}` : 'none',
                  borderRadius: 999,
                  cursor: 'pointer',
                  padding: confirmRemove === row.id ? '6px 12px' : 6,
                }}
              >
                {confirmRemove === row.id ? t.settings.subsRemoveConfirm : t.settings.subsRemove}
              </button>
            </div>

            {editing === row.id && (
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  alignItems: 'flex-end',
                  marginTop: 12,
                  padding: 14,
                  background: C.well,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                }}
              >
                <div>
                  <label
                    htmlFor={`cfg-valor-${row.id}`}
                    style={{ ...cardLabel, display: 'block', fontSize: 10.5, marginBottom: 6 }}
                  >
                    {t.settings.subsValueLabel}
                  </label>
                  <input
                    id={`cfg-valor-${row.id}`}
                    className="fam-field"
                    type="text"
                    inputMode="numeric"
                    value={editValue}
                    onChange={(e) => setEditValue(numericOnly(e.target.value))}
                    style={{ ...miniInput, width: 120 }}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`cfg-dia-${row.id}`}
                    style={{ ...cardLabel, display: 'block', fontSize: 10.5, marginBottom: 6 }}
                  >
                    {t.settings.subsDayLabel}
                  </label>
                  <input
                    id={`cfg-dia-${row.id}`}
                    className="fam-field"
                    type="text"
                    inputMode="numeric"
                    value={editDay}
                    onChange={(e) => setEditDay(e.target.value.replace(/\D/g, ''))}
                    style={{ ...miniInput, width: 90 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => saveEdit(row.id, row.dia)}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: C.chromeInk,
                    background: C.chromeSoft,
                    border: 'none',
                    borderRadius: 10,
                    padding: '11px 18px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 0 rgba(255,255,255,.5) inset',
                  }}
                >
                  {t.settings.subsSave}
                </button>
                <button
                  type="button"
                  className="fam-quiet"
                  onClick={() => setEditing(null)}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    color: C.text2,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '11px 4px',
                  }}
                >
                  {t.settings.subsCancel}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
