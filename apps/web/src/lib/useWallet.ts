'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/extended-chains';
import { createApi } from './api';

/**
 * Returns the user's Stellar embedded wallet address (or null if none yet),
 * and an `ensureWallet()` function that finds or creates one and registers it
 * with the FixEarn backend (idempotent upsert).
 *
 * Non-custodial contract: we NEVER touch private keys — wallet creation and
 * signing are entirely Privy's responsibility. We only read the address.
 */
export function useWallet(): { address: string | null; ensureWallet: () => Promise<string> } {
  const { user, getAccessToken } = usePrivy();
  const { createWallet } = useCreateWallet();

  const stellarAccount = user?.linkedAccounts?.find(
    (a) => a.type === 'wallet' && (a as { chainType: string }).chainType === 'stellar',
  ) as { address: string } | undefined;

  const address = stellarAccount?.address ?? null;

  async function ensureWallet(): Promise<string> {
    const api = createApi(getAccessToken);

    if (stellarAccount) {
      // Wallet already exists — just register (idempotent) and return the address.
      await api.registerWallet({ stellarAddress: stellarAccount.address });
      return stellarAccount.address;
    }

    // No Stellar wallet yet — ask Privy to create one.
    const { wallet } = await createWallet({ chainType: 'stellar' });
    const newAddress = wallet.address;

    // Register with backend.
    await api.registerWallet({ stellarAddress: newAddress });
    return newAddress;
  }

  return { address, ensureWallet };
}
