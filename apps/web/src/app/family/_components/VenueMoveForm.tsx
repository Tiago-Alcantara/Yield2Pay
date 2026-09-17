'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { C, CHROME_SHADOW, cardLabel } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { FamilyBrand } from './FamilyUI';
import { ChainUnlockPanel } from '@/components/ChainUnlockPanel';
import { useVenueTx } from '@/lib/useVenueTx';
import { createApi } from '@/lib/api';
import { resolveVenueFromAccount, type VenueIdPath } from '@/lib/resolveVenueFromAccount';
import { toBaseUnitsForVenue, formatUsdc } from '@/lib/money';
import { validateAmount } from '@/lib/validateAmount';
import { getErrorMessage } from '@/lib/errors';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';

export interface VenueMoveFormProps {
  mode: 'deposit' | 'withdraw';
  /** Máximo movível em base units. TODO: buscar spendable/vault real quando a API multichain estiver pronta. */
  maxBaseUnits?: string;
}

const FALLBACK_VENUE: VenueIdPath = { chain: 'stellar', protocol: 'blend' };

/** Placeholder alto até termos saldo spendable/vault por venue na API família. */
export const PLACEHOLDER_MAX_BASE_UNITS = '1000000000000';

const COPY = {
  deposit: {
    title: 'Investir no cofre',
    sub: 'Transfere USDC da sua carteira para o cofre on-chain. O principal continua seu.',
    source: 'Da carteira',
    cta: 'Confirmar investimento',
    success: 'Investimento confirmado!',
  },
  withdraw: {
    title: 'Sacar do cofre',
    sub: 'Resgata USDC do cofre on-chain de volta para a sua carteira.',
    source: 'Do cofre',
    cta: 'Confirmar saque do cofre',
    success: 'Saque do cofre confirmado!',
  },
} as const;

export function VenueMoveForm({
  mode,
  maxBaseUnits = PLACEHOLDER_MAX_BASE_UNITS,
}: VenueMoveFormProps) {
  const router = useRouter();
  const { t, state } = useFamily();

  if (!isPrivyConfigured) {
    return (
      <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
        <div className="fam-center-shell">
          <div style={{ marginBottom: 'clamp(22px,5vw,34px)' }}>
            <FamilyBrand tag={t.brandTag} size={20} href="/family/dashboard" />
          </div>
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              padding: 'var(--fam-card-pad-lg)',
            }}
          >
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text2, margin: 0 }}>
              Configure o Privy para investir ou sacar do cofre on-chain.
            </p>
            <button
              type="button"
              className="fam-quiet"
              onClick={() => router.push('/family/dashboard')}
              style={{
                width: '100%',
                fontFamily: 'inherit',
                fontSize: 14,
                color: C.text2,
                background: 'none',
                border: 'none',
                padding: '12px 0 0',
                cursor: 'pointer',
              }}
            >
              Voltar ao painel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <VenueMoveFormWithPrivy
      mode={mode}
      maxBaseUnits={maxBaseUnits}
      apyPercent={String(state.rate)}
      onBack={() => router.push('/family/dashboard')}
    />
  );
}

interface VenueMoveFormWithPrivyProps {
  mode: 'deposit' | 'withdraw';
  maxBaseUnits: string;
  apyPercent: string;
  onBack: () => void;
}

function VenueMoveFormWithPrivy({
  mode,
  maxBaseUnits,
  apyPercent,
  onBack,
}: VenueMoveFormWithPrivyProps) {
  const { t } = useFamily();
  const { getAccessToken } = usePrivy();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  const [loadedVenue, setLoadedVenue] = useState<VenueIdPath | null>(null);
  const [venueLoadError, setVenueLoadError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [api]);

  const activeVenue = loadedVenue;
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

  const previewMonthly = (() => {
    if (mode !== 'deposit' || formatError !== null) return null;
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
    const truncated = (BigInt(maxBaseUnits) / BigInt(100000)) * BigInt(100000);
    setAmountRaw(formatUsdc(truncated.toString()));
  }

  async function handleConfirm() {
    if (!isValid || !venueReady) return;
    setSubmitting(true);
    setTxError(null);
    try {
      const currentAccount = await api.getAccountChain();
      const currentVenue = resolveVenueFromAccount(currentAccount);
      if (
        currentVenue.chain !== activeVenue.chain ||
        currentVenue.protocol !== activeVenue.protocol
      ) {
        setLoadedVenue(currentVenue);
        setTxError('Rede atualizada. Confirme novamente.');
        return;
      }
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
      <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
        <div className="fam-center-shell">
          <div style={{ marginBottom: 'clamp(22px,5vw,34px)' }}>
            <FamilyBrand tag={t.brandTag} size={20} href="/family/dashboard" />
          </div>
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              padding: 'var(--fam-card-pad-lg)',
              boxShadow: '0 24px 56px rgba(0,0,0,.5)',
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                fontSize: 'clamp(22px,5.6vw,26px)',
                fontWeight: 700,
                letterSpacing: '-.02em',
                margin: 0,
                color: C.textStrong,
              }}
            >
              {copy.success}
            </h1>
            <div
              style={{
                marginTop: 20,
                padding: 16,
                background: C.well,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                fontFamily: C.mono,
                fontSize: 13,
                color: C.silver,
                wordBreak: 'break-all',
                textAlign: 'left',
              }}
            >
              <div style={{ ...cardLabel, marginBottom: 8 }}>Transaction hash</div>
              <span style={{ color: C.textStrong }}>{txHash}</span>
            </div>
            <button
              type="button"
              className="btn-shine"
              onClick={onBack}
              style={{
                width: '100%',
                fontFamily: 'inherit',
                fontSize: 15,
                fontWeight: 600,
                color: C.chromeInk,
                background: C.chromeSoft,
                border: 'none',
                borderRadius: 12,
                padding: 14,
                cursor: 'pointer',
                marginTop: 20,
                boxShadow: CHROME_SHADOW,
              }}
            >
              Voltar ao painel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
      <div className="fam-center-shell">
        <div style={{ marginBottom: 'clamp(22px,5vw,34px)' }}>
          <FamilyBrand tag={t.brandTag} size={20} href="/family/dashboard" />
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: 'var(--fam-card-pad-lg)',
            boxShadow: '0 24px 56px rgba(0,0,0,.5)',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(22px,5.6vw,26px)',
              fontWeight: 700,
              letterSpacing: '-.02em',
              margin: 0,
              color: C.textStrong,
              textWrap: 'balance',
            }}
          >
            {copy.title}
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text2, margin: '10px 0 0' }}>
            {copy.sub}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              margin: '22px 0 8px',
            }}
          >
            <label htmlFor="fam-venue-amount" style={cardLabel}>
              Valor (USDC)
            </label>
            <button
              type="button"
              className="fam-quiet"
              onClick={fillMax}
              style={{
                fontFamily: C.mono,
                fontSize: 11.5,
                color: C.silver,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              max ${formatUsdc(maxBaseUnits)}
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                fontFamily: C.mono,
                fontSize: 16,
                color: C.text3,
                pointerEvents: 'none',
              }}
            >
              $
            </span>
            <input
              id="fam-venue-amount"
              className="fam-field"
              type="text"
              inputMode="decimal"
              value={amountRaw}
              onChange={(e) => {
                setTouched(true);
                setAmountRaw(e.target.value);
              }}
              placeholder="0.00"
              aria-label="Valor"
              aria-invalid={touched && validationError ? true : undefined}
              style={{
                width: '100%',
                background: C.well,
                border: `1px solid ${touched && validationError ? C.inputError : C.border}`,
                borderRadius: 12,
                padding: '13px 14px 13px 28px',
                color: C.textStrong,
                fontFamily: C.mono,
                fontSize: 16,
                outline: 'none',
              }}
            />
          </div>
          {touched && validationError && (
            <div role="alert" style={{ fontSize: 12.5, color: C.danger, marginTop: 8 }}>
              {validationError}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 10,
              fontFamily: C.mono,
              fontSize: 11.5,
              color: C.text4,
            }}
          >
            <span>{copy.source}</span>
            {!venueReady && <span>Carregando venue…</span>}
          </div>

          {previewMonthly && (
            <div
              style={{
                marginTop: 14,
                fontFamily: C.mono,
                fontSize: 13,
                color: C.text2,
              }}
            >
              Rende ~${previewMonthly}/mês ({apyPercent}% a.a.)
            </div>
          )}

          {(txError || venueLoadError) && (
            <div role="alert" style={{ fontSize: 13, color: C.danger, marginTop: 14 }}>
              {txError ?? venueLoadError}
            </div>
          )}

          <button
            type="button"
            className="btn-shine"
            onClick={() => void handleConfirm()}
            disabled={!isValid || submitting || !venueReady}
            style={{
              width: '100%',
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 600,
              color: C.chromeInk,
              background: C.chromeSoft,
              border: 'none',
              borderRadius: 12,
              padding: 14,
              cursor: !isValid || submitting || !venueReady ? 'not-allowed' : 'pointer',
              marginTop: 20,
              boxShadow: CHROME_SHADOW,
              opacity: !isValid || submitting || !venueReady ? 0.6 : 1,
            }}
          >
            {submitting ? 'Confirmando…' : copy.cta}
          </button>
          <button
            type="button"
            className="fam-quiet"
            onClick={onBack}
            style={{
              width: '100%',
              fontFamily: 'inherit',
              fontSize: 14,
              color: C.text2,
              background: 'none',
              border: 'none',
              padding: '12px 0 0',
              cursor: 'pointer',
            }}
          >
            Voltar ao painel
          </button>
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: 'var(--fam-card-pad)',
            marginTop: 16,
            color: C.text,
          }}
        >
          <ChainUnlockPanel />
        </div>
      </div>
    </div>
  );
}
