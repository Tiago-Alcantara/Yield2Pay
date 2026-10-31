'use client';

import React, { useEffect, useRef, useState } from 'react';
import { C } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { useTheme } from '../_lib/ThemeProvider';
import type { ThemeDef } from '../_lib/themes';

/** Miniatura do tema: cartão principal à esquerda, dois cards à direita. */
function Swatch({ theme }: { theme: ThemeDef }) {
  const edge = `1px solid ${theme.b}`;
  const bar = (left: string, top: number, width: string | number, bg: string, opacity = 1): React.CSSProperties => ({
    position: 'absolute',
    left,
    top,
    width,
    height: 4,
    borderRadius: 9,
    background: bg,
    opacity,
  });
  const mini = (top: number): React.CSSProperties => ({
    position: 'absolute',
    left: '58%',
    right: 10,
    top,
    height: 34,
    borderRadius: 8,
    background: theme.card,
    border: edge,
  });
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        position: 'relative',
        height: 96,
        borderRadius: 12,
        background: theme.bg,
        border: edge,
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 10,
          top: 10,
          right: '46%',
          bottom: 10,
          borderRadius: 9,
          background: theme.hero,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12)',
        }}
      >
        <span style={bar('9px', 10, 30, '#9a9da1', 0.8)} />
        <span style={{ ...bar('9px', 22, 54, '#f2f3f4'), height: 9 }} />
        <span style={{ ...bar('9px', 0, 'auto', 'rgba(255,255,255,.2)'), top: 'auto', right: 9, bottom: 10, height: 3 }} />
      </span>
      <span style={mini(10)} />
      <span style={mini(52)} />
      <span style={bar('calc(58% + 8px)', 20, '40%', theme.dark ? '#9a9da1' : '#6b6f75', 0.6)} />
      <span style={bar('calc(58% + 8px)', 62, '40%', theme.dark ? '#9a9da1' : '#6b6f75', 0.6)} />
    </span>
  );
}

/**
 * Aparência: escolha do tema. Aplica na hora, persiste (ThemeProvider) e vale
 * para todas as telas da família.
 */
export function AppearanceSection() {
  const { t } = useFamily();
  const { theme, themes, setTheme } = useTheme();
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const a = t.settings.appearance;

  useEffect(() => () => clearTimeout(timer.current), []);

  function choose(next: ThemeDef) {
    setTheme(next.id);
    setToast(a.applied(next.name));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 2400);
  }

  const groups: Array<[string, string, ThemeDef[]]> = [
    [a.dark, a.darkAria, themes.filter((x) => x.dark)],
    [a.light, a.lightAria, themes.filter((x) => !x.dark)],
  ];

  return (
    <div
      style={{
        background: 'var(--fx-surface-3)',
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        padding: 'var(--fam-card-pad, 28px)',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: C.textStrong, letterSpacing: '-0.01em' }}>{a.title}</div>
      <p style={{ fontSize: 14, color: C.text2, margin: '6px 0 22px', lineHeight: 1.5 }}>{a.sub}</p>

      {groups.map(([label, aria, list]) => (
        <React.Fragment key={label}>
          <div
            style={{
              fontFamily: C.mono,
              fontSize: 11,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: C.text3,
              margin: '4px 0 12px',
            }}
          >
            {label} · {list.length}
          </div>
          <div
            role="radiogroup"
            aria-label={aria}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 14,
              marginBottom: 24,
            }}
          >
            {list.map((item) => {
              const on = item.id === theme.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => choose(item)}
                  style={{
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    padding: '10px 10px 14px',
                    borderRadius: 16,
                    background: on ? 'rgba(127,127,127,.08)' : 'transparent',
                    border: `1px solid ${on ? C.text2 : C.border}`,
                    boxShadow: on ? '0 0 0 3px rgba(127,127,127,.15)' : 'none',
                    transition: 'border-color .2s',
                  }}
                >
                  <Swatch theme={item} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <b style={{ fontSize: 14.5, fontWeight: 600, color: C.textStrong }}>{item.name}</b>
                      <span style={{ fontSize: 12.5, color: C.text3, lineHeight: 1.4 }}>{item.desc}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      style={{
                        flex: '0 0 auto',
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: `1.5px solid ${on ? C.textStrong : 'var(--fx-border-strong)'}`,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {on && <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.textStrong }} />}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </React.Fragment>
      ))}

      <div style={{ paddingTop: 18, borderTop: `1px solid ${C.border}`, fontSize: 13, color: C.text3 }}>{a.saved}</div>

      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 120,
          transform: `translate(-50%, ${toast ? 0 : 16}px)`,
          opacity: toast ? 1 : 0,
          pointerEvents: 'none',
          transition: '.25s',
          zIndex: 60,
          background: 'var(--fx-surface-3)',
          border: `1px solid ${C.borderStrong}`,
          borderRadius: 12,
          padding: '11px 16px',
          fontSize: 13.5,
          color: C.textStrong,
          boxShadow: '0 18px 44px rgba(0,0,0,.35)',
        }}
      >
        {toast}
      </div>
    </div>
  );
}
