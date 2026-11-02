import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  /** Show a glowing silver status dot before the label. @default false */
  dot?: boolean;
  style?: React.CSSProperties;
}

/** Mono status pill — silver outline, optional glowing dot. Used for "Active", tags, kickers. */
export function Badge({ children, dot = false, style = {}, ...rest }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: 'var(--fx-font-mono)',
        fontSize: 13,
        letterSpacing: 0,
        color: 'var(--fx-silver-bright)',
        border: '1px solid var(--fx-border-metal)',
        borderRadius: 'var(--fx-radius-pill)',
        padding: '4px 11px',
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--fx-silver-bright)',
            boxShadow: 'var(--fx-glow-silver)',
          }}
        />
      )}
      {children}
    </span>
  );
}
