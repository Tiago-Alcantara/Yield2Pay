'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from '@/lib/useWallet';
import { isFinancialProductEnabled } from '@/lib/financial-product';

/**
 * AuthGate — wraps authenticated app pages.
 *
 * - If Privy is ready and the user is NOT authenticated, redirects to /login.
 * - Once authenticated, and only with the financial product enabled, calls
 *   ensureWallet() once to provision a Stellar embedded wallet.
 *
 * Renders nothing until Privy is ready (avoids flash of unauthenticated content).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { ensureWallet } = useWallet();

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      router.replace('/login?next=/b2b/dashboard');
      return;
    }

    if (!isFinancialProductEnabled()) return;

    // Authenticated — provision wallet once. Fire-and-forget; errors are
    // non-fatal for page rendering (the wallet is re-attempted next session).
    ensureWallet().catch((err) => {
      console.error('[AuthGate] ensureWallet failed:', err);
    });
    // We intentionally depend only on `ready` and `authenticated` to run once.
    // ensureWallet is stable across renders (new function reference each render
    // but the underlying Privy state drives it).
  }, [ready, authenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render children only once Privy is ready AND the user is authenticated.
  // Guarding on `authenticated` (not just `ready`) prevents a one-render flash
  // of protected content while the redirect effect runs asynchronously.
  if (!ready || !authenticated) return null;

  return <>{children}</>;
}
