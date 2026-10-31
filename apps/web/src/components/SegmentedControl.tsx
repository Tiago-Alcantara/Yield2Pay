'use client';

import React from 'react';

export interface SegOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options?: Array<string | SegOption>;
  value?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

/** Segmented control — also the EN/PT language toggle. Options are strings or {value, label}. */
export function SegmentedControl({
  options = [],
  value,
  onChange,
  size = 'md',
  style = {},
}: SegmentedControlProps) {
  const pad = size === 'sm' ? '5px 12px' : '8px 16px';
  const fs = size === 'sm' ? 12.5 : 14;

  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        border: '1px solid var(--fx-border)',
        borderRadius: 999,
        padding: 3,
        gap: 2,
        background: 'var(--fx-surface-2)',
        ...style,
      }}
    >
      {options.map((o, i) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const on = v === value;
        return (
          <button
            key={i}
            type="button"
            aria-pressed={on}
            onClick={() => onChange && onChange(v)}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: pad,
              fontSize: fs,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--fx-font-display)',
              letterSpacing: '.02em',
              background: on ? 'var(--fam-chip-on, #2E3136)' : 'transparent',
              color: on ? 'var(--fx-text-strong)' : 'var(--fx-text-2)',
              transition:
                'background var(--fx-dur-fast) var(--fx-ease), color var(--fx-dur-fast) var(--fx-ease)',
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
