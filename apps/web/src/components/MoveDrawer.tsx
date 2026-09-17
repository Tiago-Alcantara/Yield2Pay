'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { MetalCard } from './MetalCard';
import { Button } from './Button';
import { Input } from './Input';
import { TxErrorBox } from './TxErrorBox';
import { useVenueTx } from '@/lib/useVenueTx';
import { createApi } from '@/lib/api';
import { resolveVenueFromAccount, type VenueIdPath } from '@/lib/resolveVenueFromAccount';
import { toBaseUnitsForVenue, formatUsdc } from '@/lib/money';
import { validateAmount } from '@/lib/validateAmount';
import { getErrorMessage } from '@/lib/errors';

export interface MoveDrawerProps {
  mode: 'deposit' | 'withdraw';
  /** When omitted, resolved once on mount from account chain. */
  venue?: VenueIdPath;
  /** Máximo movível, em base units (deposit = spendable da carteira; withdraw = posição do vault). */
  maxBaseUnits: string;
  apyPercent: string;
  onClose: () => void;
  onSuccess: () => void;
}

const FALLBACK_VENUE: VenueIdPath = { chain: 'stellar', protocol: 'blend' };

const COPY = {
  deposit: { title: 'Aportar no vault', cta: 'Confirmar aporte', source: 'Da carteira', success: 'Aporte confirmado!' },
  withdraw: { title: 'Sacar do vault', cta: 'Confirmar saque', source: 'Do vault', success: 'Saque confirmado!' },
} as const;

export function MoveDrawer({ mode, venue: venueProp, maxBaseUnits, apyPercent, onClose, onSuccess }: MoveDrawerProps) {
  const { getAccessToken } = usePrivy();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  const [loadedVenue, setLoadedVenue] = useState<VenueIdPath | null>(null);
  const [venueLoadError, setVenueLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (venueProp) return;

    let cancelled = false;
    void (async () => {
      try {
        const account = await api.getAccountChain();
        if (!cancelled) {
          setLoadedVenue(resolveVenueFromAccount(account));
        }
      } catch (error) {
        if (!cancelled) {
          setVenueLoadError(getErrorMessage(error));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [venueProp, api]);

  const activeVenue = venueProp ?? loadedVenue;
  const venueDecimals = activeVenue?.chain === 'solana' ? 6 : 7;
  const tx = useVenueTx(activeVenue ?? FALLBACK_VENUE);
  const copy = COPY[mode];

  const [amountRaw, setAmountRaw] = useState('');
  const [touched, setTouched] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formatError = validateAmount(amountRaw, venueDecimals);
  const overMax =
    formatError === null &&
    BigInt(toBaseUnitsForVenue(amountRaw, venueDecimals)) >
      BigInt(maxBaseUnits);
  const validationError = formatError ?? (overMax ? 'Acima do disponível' : null);
  const isValid = validationError === null;
  const venueReady = activeVenue !== null;

  // Preview de rendimento mensal (informativo): valor × apy% / 12.
  const previewMonthly = (() => {
    if (formatError !== null) return null;
    const apyBps = Math.round(parseFloat(apyPercent || '0') * 100);
    if (!apyBps) return null;
    const monthly =
      (BigInt(toBaseUnitsForVenue(amountRaw, venueDecimals)) *
        BigInt(apyBps)) /
      BigInt(10000) /
      BigInt(12);
    return formatUsdc(monthly.toString());
  })();

  function fillMax() {
    setTouched(true);
    // Trunca pra 2 casas (escala 10^(7-2)) pra nunca arredondar acima do máximo.
    const truncated = (BigInt(maxBaseUnits) / BigInt(100000)) * BigInt(100000);
    setAmountRaw(formatUsdc(truncated.toString()));
  }

  async function handleConfirm() {
    if (!isValid || !venueReady) return;
    setSubmitting(true);
    setTxError(null);
    try {
      const hash = await tx[mode](
        toBaseUnitsForVenue(amountRaw, venueDecimals),
      );
      setTxHash(hash);
    } catch (err) {
      setTxError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (txHash) {
    return (
      <Overlay onClose={onSuccess}>
        <MetalCard padding={0} radius="var(--fx-radius-2xl)" style={{ border: '1px solid var(--fx-border-metal)' }}>
          <div style={{ padding: 28, textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--fx-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--fx-text)', margin: 0 }}>
              {copy.success}
            </h2>
            <div
              style={{
                marginTop: 20,
                padding: 16,
                background: 'var(--fx-surface-2)',
                border: '1px solid var(--fx-border)',
                borderRadius: 'var(--fx-radius-md)',
                fontFamily: 'var(--fx-font-mono)',
                fontSize: 13,
                color: 'var(--fx-silver)',
                wordBreak: 'break-all',
              }}
            >
              <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fx-text-3)', marginBottom: 8 }}>
                Transaction hash
              </div>
              <span style={{ color: 'var(--fx-text)' }}>{txHash}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
              <Button onClick={onSuccess}>Fechar</Button>
            </div>
          </div>
        </MetalCard>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <MetalCard padding={0} radius="var(--fx-radius-2xl)" style={{ border: '1px solid var(--fx-border-metal)' }}>
        <div style={{ padding: 28 }}>
          <h2 style={{ fontFamily: 'var(--fx-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--fx-text)', margin: 0 }}>
            {copy.title}
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
            <span style={{ fontSize: 13, color: 'var(--fx-text-3)' }}>{copy.source}</span>
            <button
              type="button"
              onClick={fillMax}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fx-silver)', fontSize: 13, fontFamily: 'var(--fx-font-mono)' }}
            >
              max ${formatUsdc(maxBaseUnits)}
            </button>
          </div>
          <div style={{ marginTop: 8 }}>
            <Input
              label="Valor"
              prefix="$"
              value={amountRaw}
              onChange={(e) => { setTouched(true); setAmountRaw(e.target.value); }}
              placeholder="0.00"
              hint={touched && validationError ? validationError : undefined}
              aria-label="Valor"
            />
          </div>
          {mode === 'deposit' && previewMonthly && (
            <div style={{ marginTop: 14, fontFamily: 'var(--fx-font-mono)', fontSize: 13, color: 'var(--fx-text-2)' }}>
              Rende ~${previewMonthly}/mês ({apyPercent}% a.a.)
            </div>
          )}
          {(txError || venueLoadError) && (
            <TxErrorBox message={txError ?? venueLoadError ?? ''} />
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!isValid || submitting || !venueReady}>
              {submitting ? 'Confirmando…' : copy.cta}
            </Button>
          </div>
        </div>
      </MetalCard>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '100%' }}>
        {children}
      </div>
    </div>
  );
}
