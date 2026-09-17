'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import type { AccountChainView } from '@yield2pay/shared';
import { createApi } from '@/lib/api';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';
import { Button } from './Button';
import { getErrorMessage } from '@/lib/errors';

const CHAIN_LABELS: Record<AccountChainView['selectedChain'], string> = {
  stellar: 'Stellar',
  solana: 'Solana',
};

function formatChainList(chains: AccountChainView['unlockedChains']): string {
  return chains.map((chainId) => CHAIN_LABELS[chainId]).join(', ');
}

export function ChainUnlockPanel() {
  if (!isPrivyConfigured) {
    return (
      <section aria-label="Redes blockchain">
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Redes</div>
        <div style={{ fontSize: 14, opacity: 0.8 }}>Configure o Privy para gerir redes.</div>
      </section>
    );
  }

  return <ChainUnlockPanelWithPrivy />;
}

function ChainUnlockPanelWithPrivy() {
  const { getAccessToken } = usePrivy();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  const [accountChain, setAccountChainState] = useState<AccountChainView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const view = await api.getAccountChain();
        if (!cancelled) {
          setAccountChainState(view);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  async function runChainAction(
    body: { action: 'unlock' | 'select'; chainId: 'stellar' | 'solana' },
  ): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.setAccountChain(body);
      setAccountChainState(updated);
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setBusy(false);
    }
  }

  const solanaUnlocked = accountChain?.unlockedChains.includes('solana') ?? false;
  const showUnlockSolana = accountChain !== null && !solanaUnlocked;
  const showSelectStellar =
    accountChain !== null &&
    accountChain.unlockedChains.includes('stellar') &&
    accountChain.selectedChain !== 'stellar';
  const showSelectSolana =
    accountChain !== null &&
    accountChain.unlockedChains.includes('solana') &&
    accountChain.selectedChain !== 'solana';

  return (
    <section aria-label="Redes blockchain">
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Redes</div>

      {loading && <div style={{ fontSize: 14, opacity: 0.8 }}>Carregando…</div>}

      {!loading && accountChain && (
        <>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            <div>
              Selecionada: <strong>{CHAIN_LABELS[accountChain.selectedChain]}</strong>
            </div>
            <div>
              Desbloqueadas: <strong>{formatChainList(accountChain.unlockedChains)}</strong>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 14,
            }}
          >
            {showUnlockSolana && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void runChainAction({ action: 'unlock', chainId: 'solana' })}
              >
                Desbloquear Solana
              </Button>
            )}
            {showSelectStellar && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void runChainAction({ action: 'select', chainId: 'stellar' })}
              >
                Selecionar Stellar
              </Button>
            )}
            {showSelectSolana && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void runChainAction({ action: 'select', chainId: 'solana' })}
              >
                Selecionar Solana
              </Button>
            )}
          </div>
        </>
      )}

      {error && (
        <div role="alert" style={{ fontSize: 13, color: '#f87171', marginTop: 10 }}>
          {error}
        </div>
      )}
    </section>
  );
}
