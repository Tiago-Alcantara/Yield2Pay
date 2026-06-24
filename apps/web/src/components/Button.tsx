'use client';

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. @default "primary" */
  variant?: 'primary' | 'secondary' | 'ghost' | 'chrome';
  /** Size. @default "md" */
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * FixEarn primary action. Polished-chrome primary, hairline secondary, quiet ghost.
 * "chrome" is an alias for "primary".
 */
export function Button({
  variant = 'primary',
  size = 'md',
  children,
  style = {},
  disabled,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = React.useState(false);

  const sizes: Record<string, React.CSSProperties> = {
    sm: { padding: '10px 18px', fontSize: 14 },
    md: { padding: '15px 30px', fontSize: 15 },
    lg: { padding: '16px 36px', fontSize: 16 },
  };

  // "chrome" is an alias for "primary"
  const resolvedVariant = variant === 'chrome' ? 'primary' : variant;

  const base: React.CSSProperties = {
    fontFamily: 'var(--fx-font-display)',
    fontWeight: 600,
    borderRadius: 'var(--fx-radius-pill)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    textDecoration: 'none',
    opacity: disabled ? 0.5 : 1,
    transition:
      'transform var(--fx-dur-fast) var(--fx-ease), box-shadow var(--fx-dur-fast) var(--fx-ease), filter var(--fx-dur-fast) var(--fx-ease), border-color var(--fx-dur-fast) var(--fx-ease)',
    ...sizes[size],
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      color: 'var(--fx-chrome-ink)',
      background: 'var(--fx-chrome)',
      boxShadow: 'var(--fx-elev-chrome)',
    },
    secondary: {
      color: 'var(--fx-text)',
      background: 'rgba(255,255,255,.025)',
      borderColor: 'var(--fx-border-strong)',
    },
    ghost: { color: 'var(--fx-text-2)', background: 'transparent' },
  };

  const hoveredStyles: Record<string, React.CSSProperties> = {
    primary: {
      transform: 'translateY(-1px) scale(1.02)',
      filter: 'brightness(1.04)',
      boxShadow: 'var(--fx-elev-chrome-hover)',
    },
    secondary: {
      transform: 'translateY(-1px)',
      borderColor: 'var(--fx-silver)',
      background: 'rgba(192,194,197,.06)',
    },
    ghost: { color: 'var(--fx-text)' },
  };

  return (
    <button
      disabled={disabled}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...base,
        ...variantStyles[resolvedVariant],
        ...(hover && !disabled ? hoveredStyles[resolvedVariant] : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
