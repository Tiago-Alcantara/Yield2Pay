'use client';

import { useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import type { OnrampResult } from '@yield2pay/shared';
import { useWallet } from './useWallet';
import { createApi } from './api';
import { toBaseUnits } from './money';

export type DepositState =
  | 'idle'
  | 'quoting'
  | 'awaiting_pix'
  | 'funded'
  | 'applying'
  | 'done'
  | 'error';

/** Trunca uma string decimal pra no máximo 7 casas (base units do Stellar). */
function truncateTo7(s: string): string {
  const [whole, frac = ''] = s.split('.');
  return frac ? `${whole}.${frac.slice(0, 7)}` : whole;
}

/**
 * Orquestra o fluxo de depósito via Pix, escondendo o web3:
 *   start(R$) → order Etherfuse → (usuário paga Pix / simula) → funded
 *   → confirm() → claim (se houver) + auto-depósito no cofre USDC → done
 *
 * As 2 assinaturas Privy (claim + depósito) ficam atrás do gesto `confirm`.
 * `confirm` guarda sub-progresso: se o depósito falha depois do claim, um
 * retry NÃO re-claima.
 */
export function useDepositFlow() {
  const { getAccessToken, user } = usePrivy();
  const { ensureWallet } = useWallet();
  const { signRawHash } = useSignRawHash();
  const api = createApi(getAccessToken);

  const [state, setState] = useState<DepositState>('idle');
  const [order, setOrder] = useState<OnrampResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const claimedRef = useRef(false);

  async function start(amountBrl: string): Promise<void> {
    setError(null);
    setState('quoting');
    try {
      const status = await api.getRampStatus();
      if (!status.ready) {
        const email = user?.email?.address ?? 'demo@fixearn.com';
        const displayName = user?.email?.address?.split('@')[0] ?? 'Demo User';
        await api.rampSetup({ email, displayName });
      }
      const result = await api.startOnramp({ amountFiat: amountBrl });
      setOrder(result);
      claimedRef.current = false;
      setState('awaiting_pix');
    } catch (e) {
      setError(getErr(e));
      setState('error');
      throw e;
    }
  }

  /** Sandbox: simula o Pix e faz poll até `completed` (quando o claim aparece). */
  async function simulate(): Promise<void> {
    if (!order) return;
    setError(null);
    try {
      await api.simulateFiatReceived({ orderId: order.orderId });
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await api.getRampOrder(order.orderId);
        if (s.status === 'completed') {
          setState('funded');
          return;
        }
      }
      // Não chegou a completed no tempo — deixa o usuário tentar confirmar.
      setState('funded');
    } catch (e) {
      setError(getErr(e));
      setState('error');
    }
  }

  /** Claim (se houver) + auto-depósito no cofre. Um gesto do usuário. */
  async function confirm(): Promise<void> {
    if (!order) return;
    setError(null);
    setState('applying');
    try {
      const address = await ensureWallet();

      // 1) Claim — só se ainda não foi feito nesta jornada.
      if (!claimedRef.current) {
        const claim = await api.getOrderClaim(order.orderId);
        if (!claim.skip && claim.xdr && claim.hash) {
          const { signature } = await signRawHash({
            address,
            chainType: 'stellar',
            hash: claim.hash as `0x${string}`,
          });
          await api.submitOrderClaim(order.orderId, {
            xdr: claim.xdr,
            signatureHex: signature,
            stellarAddress: address,
          });
        }
        claimedRef.current = true;
      }

      // 2) Depósito no cofre USDC (valor = USDC recebido, truncado a 7 casas).
      const baseUnits = toBaseUnits(truncateTo7(order.targetAmount));
      const { xdr, hash } = await api.buildDeposit(baseUnits);
      const { signature } = await signRawHash({
        address,
        chainType: 'stellar',
        hash: hash as `0x${string}`,
      });
      await api.submitDeposit({
        xdr,
        signatureHex: signature,
        stellarAddress: address,
        amount: baseUnits,
        rampOrderId: order.orderId,
      });

      setState('done');
    } catch (e) {
      setError(getErr(e));
      setState('funded'); // permite retry do confirm sem re-claimar
      throw e;
    }
  }

  function reset(): void {
    setState('idle');
    setOrder(null);
    setError(null);
    claimedRef.current = false;
  }

  return { state, order, error, start, simulate, confirm, reset };
}

function getErr(e: unknown): string {
  // ApiError guarda a mensagem real do backend em `body`; `message` é só
  // "ApiError: <status>". Preferimos `body.message` quando existir.
  if (e && typeof e === 'object' && 'body' in e) {
    const body = (e as { body?: unknown }).body;
    if (body && typeof body === 'object' && 'message' in body) {
      const m = (body as { message?: unknown }).message;
      if (typeof m === 'string' && m) return m;
      if (Array.isArray(m) && m.length) return String(m[0]);
    }
  }
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message);
  }
  return 'Algo deu errado. Tente de novo.';
}
