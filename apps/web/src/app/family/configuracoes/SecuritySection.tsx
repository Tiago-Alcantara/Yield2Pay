'use client';

import React, { useState } from 'react';
import { C, cardLabel } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { FamilySwitch, MetalPanel } from '../_components/FamilyUI';

/** Acesso e segurança: recuperação, 2FA e sessões abertas. */
export function SecuritySection() {
  const { t, state, patch } = useFamily();
  const [confirmDevice, setConfirmDevice] = useState<string | null>(null);

  function endSession(id: string) {
    if (confirmDevice !== id) {
      setConfirmDevice(id);
      return;
    }
    setConfirmDevice(null);
    patch({ devices: state.devices.map((d) => (d.id === id ? { ...d, ended: true } : d)) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <MetalPanel radius={20} padding="var(--fam-card-pad)" sweep={false}>
        <div
          style={{
            fontFamily: C.mono,
            fontSize: 11,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: C.text2,
          }}
        >
          {t.settings.recoveryKicker}
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: C.textStrong,
            marginTop: 12,
            textShadow: '0 1px 0 rgba(0,0,0,.4)',
          }}
        >
          {t.settings.recoveryTitle}
        </div>
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.65,
            color: C.textSoft,
            margin: '10px 0 0',
            maxWidth: 560,
          }}
        >
          {t.settings.recoveryBody}
        </p>
      </MetalPanel>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 'var(--fam-card-pad)' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.textStrong, letterSpacing: '-.01em' }}>
          {t.settings.accessTitle}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 18,
            padding: 16,
            background: C.well,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            flexWrap: 'wrap',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: C.tile,
              border: `1px solid ${C.borderMetal}`,
              fontWeight: 800,
              color: C.silverBright,
            }}
          >
            G
          </span>
          <span style={{ flex: 1, minWidth: 180 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: C.text }}>
              {t.settings.googleLogin}
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: C.text3, marginTop: 2 }}>
              {t.settings.lastAccess}
            </span>
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '18px 0',
            borderBottom: `1px solid ${C.borderFainter}`,
            marginTop: 6,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: C.text }}>
              {t.settings.twoFATitle}
            </span>
            <span style={{ display: 'block', fontSize: 12.5, color: C.text3, marginTop: 2 }}>
              {t.settings.twoFASub}
            </span>
          </span>
          <FamilySwitch
            checked={state.twoFA}
            onChange={() => patch({ twoFA: !state.twoFA })}
            aria-label={t.settings.twoFATitle}
          />
        </div>

        <div style={{ ...cardLabel, marginTop: 20 }}>{t.settings.devicesTitle}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
          {state.devices.map((d) => {
            const confirming = confirmDevice === d.id;
            const actionable = !d.current && !d.ended;
            return (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 0',
                  borderBottom: `1px solid ${C.borderFainter}`,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: C.text }}>
                    {d.name}
                  </span>
                  <span style={{ display: 'block', fontSize: 12.5, color: C.text3, marginTop: 2 }}>
                    {d.ended ? t.settings.deviceEnded : d.sub}
                  </span>
                </span>
                {actionable && (
                  <button
                    type="button"
                    onClick={() => endSession(d.id)}
                    style={{
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: 600,
                      color: confirming ? C.danger : C.text2,
                      background: 'none',
                      border: `1px solid ${confirming ? C.dangerBorder : C.border}`,
                      borderRadius: 999,
                      padding: '7px 14px',
                      cursor: 'pointer',
                      transition: 'all .15s ease',
                    }}
                  >
                    {confirming ? t.settings.deviceConfirm : t.settings.deviceEnd}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
