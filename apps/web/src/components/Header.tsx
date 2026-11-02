'use client';

import React from 'react';
import { SegmentedControl } from './SegmentedControl';
import { Button } from './Button';

export interface HeaderProps {
  nav?: string[];
  lang?: string;
  onLang?: (lang: string) => void;
  ctaLabel?: string;
  loginLabel?: string;
  style?: React.CSSProperties;
}

/** The full sticky marketing header: logo, center nav, language toggle, login + CTA. */
export function Header({
  nav = [],
  lang = 'pt',
  onLang,
  ctaLabel = 'Get started',
  loginLabel = 'Log in',
  style = {},
}: HeaderProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(12,13,15,.74)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        borderBottom: '1px solid var(--fx-border)',
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: 'var(--fx-container)',
          margin: '0 auto',
          padding: '15px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <a
          href="#"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 11,
              height: 11,
              background: 'var(--fx-chrome)',
              transform: 'rotate(45deg)',
              borderRadius: 2,
              boxShadow: 'var(--fx-glow-silver)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--fx-font-display)',
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: '-.01em',
              color: 'var(--fx-text)',
            }}
          >
            Yield2Pay
          </span>
        </a>
        <nav style={{ display: 'flex', gap: 28, margin: '0 auto' }}>
          {nav.map((n, i) => (
            <a
              key={i}
              href="#"
              style={{ fontSize: 14, color: 'var(--fx-text-2)', textDecoration: 'none' }}
            >
              {n}
            </a>
          ))}
        </nav>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}
        >
          <SegmentedControl
            size="sm"
            value={lang}
            onChange={onLang}
            options={[
              { value: 'en', label: 'EN' },
              { value: 'pt', label: 'PT' },
            ]}
          />
          <a
            href="#"
            style={{ fontSize: 14, color: 'var(--fx-text-2)', textDecoration: 'none' }}
          >
            {loginLabel}
          </a>
          <Button size="sm">{ctaLabel}</Button>
        </div>
      </div>
    </header>
  );
}
