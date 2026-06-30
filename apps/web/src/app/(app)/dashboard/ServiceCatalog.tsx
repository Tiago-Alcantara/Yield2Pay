'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { createApi } from '@/lib/api';
import { formatUsdc } from '@/lib/money';
import { getErrorMessage } from '@/lib/errors';
import { useIsMobile } from '@/lib/useIsMobile';
import { Badge } from '@/components/Badge';
import { Toggle } from '@/components/Toggle';
import type { Bill } from '@yield2pay/shared';
import { SERVICE_CATALOG } from './serviceCatalog';

export interface ServiceCatalogProps {
  /** Bills owned by the parent (dashboard). */
  bills: Bill[];
  /** Available monthly returns in USDC base units. '0' when not loaded. */
  spendable: string;
  /** Active category filter: 'all' | 'ai' | 'productivity' | 'dev'. */
  category: string;
  /** Called after a successful create/delete so the parent can refetch. */
  onBillsChanged: () => void;
}

const mono = "'Geist Mono', monospace";

export default function ServiceCatalog({ bills, spendable, category, onBillsChanged }: ServiceCatalogProps) {
  const { getAccessToken } = usePrivy();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  const router = useRouter();
  const isMobile = useIsMobile();

  const [pendingVendor, setPendingVendor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Headroom = available returns minus what is already committed to bills.
  const committed = useMemo(
    () => bills.reduce((sum, b) => sum + BigInt(b.monthlyCost), BigInt(0)),
    [bills],
  );
  const headroom = BigInt(spendable || '0') - committed;

  const visible = useMemo(
    () => SERVICE_CATALOG.filter((s) => category === 'all' || s.category === category),
    [category],
  );

  async function handleToggle(vendor: string, monthlyCost: string, type: Bill['type']) {
    setPendingVendor(vendor);
    setError(null);
    try {
      const existing = bills.find((b) => b.vendor === vendor);
      if (existing) await api.deleteBill(existing.id);
      else await api.createBill({ vendor, monthlyCost, type });
      onBillsChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update service'));
    } finally {
      setPendingVendor(null);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await api.deleteBill(id);
      onBillsChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove service'));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(220,50,50,.08)',
            border: '1px solid rgba(220,50,50,.25)',
            borderRadius: 'var(--fx-radius-md)',
            fontFamily: mono,
            fontSize: 13,
            color: '#ff6b6b',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Catalog grid ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {visible.map((svc) => {
          const activeBill = bills.find((b) => b.vendor === svc.vendor);
          const isActive = !!activeBill;
          const affordable = BigInt(svc.monthlyCost) <= headroom;
          const disabled = (!isActive && !affordable) || pendingVendor === svc.vendor;
          const dim = !isActive && !affordable;

          return (
            <div
              key={svc.vendor}
              style={{
                position: 'relative',
                background: 'var(--fx-surface-1)',
                borderRadius: 'var(--fx-radius-xl)',
                padding: 22,
                border: isActive ? '1px solid var(--fx-border-metal)' : '1px solid var(--fx-border)',
                boxShadow: isActive ? '0 0 0 1px var(--fx-selection-bg), 0 14px 34px rgba(0,0,0,.35)' : 'none',
                opacity: dim ? 0.5 : 1,
                transition: 'opacity var(--fx-dur-fast) var(--fx-ease)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 'var(--fx-radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--fx-metal)',
                    border: '1px solid var(--fx-border-metal)',
                    fontFamily: mono,
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--fx-silver-bright)',
                  }}
                >
                  {svc.initials}
                </span>
                {isActive && <Badge dot>Active</Badge>}
              </div>

              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fx-text-strong)', marginTop: 16 }}>
                {svc.vendor}
              </div>
              <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--fx-text-2)', marginTop: 4 }}>
                ${formatUsdc(svc.monthlyCost)}/mo
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: dim ? 'var(--fx-text-2)' : 'var(--fx-silver)' }}>
                  {isActive ? 'On' : affordable ? 'Activate' : 'Needs more capital'}
                </span>
                <Toggle
                  checked={isActive}
                  disabled={disabled}
                  onChange={() => handleToggle(svc.vendor, svc.monthlyCost, svc.type)}
                  aria-label={svc.vendor}
                />
              </div>

              {dim && (
                <button
                  type="button"
                  onClick={() => router.push('/deposit')}
                  style={{
                    marginTop: 12,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: mono,
                    fontSize: 11.5,
                    letterSpacing: '.04em',
                    color: 'var(--fx-silver)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  Increase deposit
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Active services list ─────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--fx-surface-1)',
          border: '1px solid var(--fx-border)',
          borderRadius: 'var(--fx-radius-xl)',
          padding: 26,
        }}
      >
        <h3
          style={{
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--fx-text-2)',
            margin: '0 0 18px',
          }}
        >
          Your active services
        </h3>

        {bills.length === 0 && (
          <p style={{ color: 'var(--fx-text-2)', fontSize: 14 }}>No active services yet. Activate one above.</p>
        )}

        {bills.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {bills.map((bill, i) => (
              <div
                key={bill.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0',
                  borderBottom: i < bills.length - 1 ? '1px solid var(--fx-border)' : 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 'var(--fx-radius-md)',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--fx-metal)',
                      border: '1px solid var(--fx-border-metal)',
                      fontFamily: mono,
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--fx-silver-bright)',
                    }}
                  >
                    {bill.vendor.slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--fx-text-strong)' }}>
                    {bill.vendor}
                  </span>
                </span>

                <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <span style={{ fontFamily: mono, fontSize: 14, color: 'var(--fx-silver)' }}>
                    ${formatUsdc(bill.monthlyCost)}/mo
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${bill.vendor}`}
                    onClick={() => handleRemove(bill.id)}
                    style={{
                      background: 'rgba(220,50,50,.08)',
                      border: '1px solid rgba(220,50,50,.2)',
                      borderRadius: 'var(--fx-radius-sm)',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontFamily: mono,
                      fontSize: 12,
                      color: '#ff8080',
                    }}
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
