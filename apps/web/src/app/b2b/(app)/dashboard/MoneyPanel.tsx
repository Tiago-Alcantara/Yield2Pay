'use client';

import React from 'react';
import { formatUsdc } from '@/lib/money';
import { MetalCard } from '@/components/MetalCard';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';

export interface MoneyPanelProps {
  walletBalance: string | null; // base units; null = indisponível
  spendable: string;            // base units (máximo de aporte)
  vaultValue: string;           // base units
  apyPercent: string;
  onDeposit: () => void;
  onWithdraw: () => void;
}

// ── Ícones (stroke, paleta prata) ────────────────────────────────────────────

function IconWallet() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="13.8" r="1.3" />
    </svg>
  );
}

function IconVault() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="11" cy="12" r="3.2" />
      <path d="M11 12h3.4" />
      <path d="M18 8.5v7" />
    </svg>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const iconBadgeStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  flexShrink: 0,
  borderRadius: 11,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(160deg,#43464b,#1b1d21)',
  border: '1px solid #4a4d52',
  color: '#D4D6D9',
};

const kickerStyle: React.CSSProperties = {
  fontFamily: 'var(--fx-font-mono)',
  fontSize: 11,
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: 'var(--fx-text-3)',
};

const valueStyle: React.CSSProperties = {
  fontFamily: 'var(--fx-font-mono)',
  fontSize: 34,
  fontWeight: 'var(--fx-weight-semibold)' as React.CSSProperties['fontWeight'],
  marginTop: 18,
  letterSpacing: 'var(--fx-tracking-data)',
  lineHeight: 1.05,
  textShadow: '0 1px 0 rgba(0,0,0,.4)',
};

/** Card de metal escovado (carteira ou vault) com sweep, ícone, valor e ação no rodapé. */
function MoneyCard({
  icon,
  kicker,
  value,
  valueColor,
  sub,
  action,
}: {
  icon: React.ReactNode;
  kicker: string;
  value: React.ReactNode;
  valueColor: string;
  sub: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <MetalCard padding={28} radius="var(--fx-radius-xl)">
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 184 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={iconBadgeStyle}>{icon}</span>
          <span style={kickerStyle}>{kicker}</span>
        </div>
        <div style={{ ...valueStyle, color: valueColor }}>{value}</div>
        <div style={{ marginTop: 8, minHeight: 22, display: 'flex', alignItems: 'center' }}>
          {sub}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>{action}</div>
      </div>
    </MetalCard>
  );
}

export function MoneyPanel({
  walletBalance,
  spendable,
  vaultValue,
  apyPercent,
  onDeposit,
  onWithdraw,
}: MoneyPanelProps) {
  const walletAvailable = walletBalance !== null;
  const canDeposit = walletAvailable && BigInt(spendable) > BigInt(0);
  const canWithdraw = BigInt(vaultValue) > BigInt(0);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
        gap: 16,
      }}
    >
      {/* Carteira — parado, sem render */}
      <MoneyCard
        icon={<IconWallet />}
        kicker="Carteira"
        value={walletAvailable ? `$${formatUsdc(walletBalance as string)}` : '—'}
        valueColor="var(--fx-text-strong)"
        sub={<span style={{ fontSize: 13.5, color: 'var(--fx-text-3)' }}>sem render</span>}
        action={
          <Button variant="primary" size="sm" onClick={onDeposit} disabled={!canDeposit}>
            Aportar
          </Button>
        }
      />

      {/* Vault — onde rende */}
      <MoneyCard
        icon={<IconVault />}
        kicker="Vault"
        value={`$${formatUsdc(vaultValue)}`}
        valueColor="var(--fx-silver-bright)"
        sub={<Badge dot>~{apyPercent}% a.a.</Badge>}
        action={
          <Button variant="secondary" size="sm" onClick={onWithdraw} disabled={!canWithdraw}>
            Sacar
          </Button>
        }
      />
    </div>
  );
}
