'use client';

import React from 'react';
import { MetalCard } from './MetalCard';
import { Badge } from './Badge';
import { BrandHeader } from './BrandHeader';
import { useIsMobile } from '@/lib/useIsMobile';

/**
 * Tela de sucesso de transação (depósito/saque): wrapper de página + marca +
 * card com título, subtítulo e hash da transação. Entre depósito e saque só
 * `title` e `subtitle` mudam.
 */
export function TxResultCard({
  title,
  subtitle,
  txHash,
}: {
  title: string;
  subtitle: string;
  txHash: string;
}) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: isMobile ? '24px 12px' : '48px 24px',
      }}
    >
      <div style={{ width: 520, maxWidth: '100%' }}>
        <BrandHeader />

        <MetalCard
          sweep="loop"
          padding={0}
          radius="var(--fx-radius-2xl)"
          style={{ border: '1px solid var(--fx-border-metal)', boxShadow: 'var(--fx-elev-hero)' }}
        >
          <div style={{ padding: 30, textAlign: 'center' }}>
            <h2
              style={{
                fontFamily: 'var(--fx-font-display)',
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: '-.02em',
                color: 'var(--fx-text)',
                margin: 0,
              }}
            >
              {title}
            </h2>
            <p style={{ color: 'var(--fx-text-2)', fontSize: 14, margin: '8px 0 0', lineHeight: 1.55 }}>
              {subtitle}
            </p>
            <div
              style={{
                marginTop: 24,
                padding: '18px',
                background: 'var(--fx-surface-2)',
                border: '1px solid var(--fx-border)',
                borderRadius: 'var(--fx-radius-md)',
                fontFamily: 'var(--fx-font-mono)',
                fontSize: 13,
                color: 'var(--fx-silver)',
                wordBreak: 'break-all',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  letterSpacing: 0,
                  color: 'var(--fx-text-3)',
                  marginBottom: 8,
                }}
              >
                Transaction hash
              </div>
              <span style={{ color: 'var(--fx-text)' }}>{txHash}</span>
            </div>
            <div style={{ marginTop: 24 }}>
              <Badge dot>Capital stays yours</Badge>
            </div>
          </div>
        </MetalCard>
      </div>
    </div>
  );
}
