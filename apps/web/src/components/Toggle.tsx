'use client';

import React from 'react';

export interface ToggleProps {
  /** On (true) or off (false). */
  checked: boolean;
  /** Click handler. Not called while disabled. */
  onChange?: () => void;
  /** Disable interaction. @default false */
  disabled?: boolean;
  'aria-label'?: string;
}

/** On/off switch — polished chrome when on, surface well when off. */
export function Toggle({ checked, onChange, disabled = false, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { if (!disabled) onChange?.(); }}
      style={{
        width: 42,
        height: 24,
        borderRadius: 'var(--fx-radius-pill)',
        position: 'relative',
        flexShrink: 0,
        border: checked ? '1px solid transparent' : '1px solid var(--fx-border-strong)',
        background: checked ? 'var(--fx-chrome)' : 'var(--fx-surface-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        padding: 0,
        transition:
          'background var(--fx-dur-fast) var(--fx-ease), border-color var(--fx-dur-fast) var(--fx-ease)',
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: checked ? 'var(--fx-chrome-ink)' : 'var(--fx-text-2)',
          transition: 'left var(--fx-dur-fast) var(--fx-ease)',
        }}
      />
    </button>
  );
}
