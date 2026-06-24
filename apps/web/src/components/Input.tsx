'use client';

import React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  /** Leading adornment, e.g. a currency symbol. */
  prefix?: React.ReactNode;
  /** Trailing adornment, e.g. "/ mo". */
  suffix?: React.ReactNode;
  /** Helper text below the field. */
  hint?: string;
  style?: React.CSSProperties;
}

/** Labeled mono input with optional prefix (e.g. "$") and suffix; supports type="number". */
export function Input({ label, prefix, suffix, hint, type = 'text', style = {}, ...rest }: InputProps) {
  const [focus, setFocus] = React.useState(false);
  const mono = 'var(--fx-font-mono)';

  return (
    <label style={{ display: 'block', ...style }}>
      {label && (
        <span
          style={{
            display: 'block',
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--fx-text-3)',
            marginBottom: 8,
          }}
        >
          {label}
        </span>
      )}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--fx-surface-2)',
          border: '1px solid ' + (focus ? 'var(--fx-silver)' : 'var(--fx-border)'),
          borderRadius: 'var(--fx-radius-md)',
          padding: '12px 14px',
          transition: 'border-color var(--fx-dur-fast) var(--fx-ease)',
        }}
      >
        {prefix && (
          <span style={{ fontFamily: mono, color: 'var(--fx-text-2)', fontSize: 16 }}>{prefix}</span>
        )}
        <input
          type={type}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--fx-text)',
            fontFamily: mono,
            fontSize: 16,
          }}
          {...rest}
        />
        {suffix && (
          <span style={{ fontFamily: mono, color: 'var(--fx-text-3)', fontSize: 13 }}>{suffix}</span>
        )}
      </span>
      {hint && (
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--fx-text-3)', marginTop: 8 }}>
          {hint}
        </span>
      )}
    </label>
  );
}
