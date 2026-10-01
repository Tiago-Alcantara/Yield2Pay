import { useMemo } from 'react';
import { usePrivy } from '@privy-io/expo';
import { useCreateWallet, useSignRawHash } from '@privy-io/expo/extended-chains';
import { createApi, type YieldApi } from '../api/client';
import { apiBaseUrl } from '../config';
import type { TxSigner } from '../lib/moneyJourneys';
import { profileFromUser, stellarAddressFromUser } from '../lib/user';
import { ensureStellarWallet } from '../lib/wallet';

export function useYieldApi(): {
  api: YieldApi;
  signer: TxSigner;
  profile: { email: string; displayName: string };
  logout: () => Promise<void>;
} {
  const { user, getAccessToken, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { signRawHash } = useSignRawHash();

  const api = useMemo(
    () => createApi({ baseUrl: apiBaseUrl(), getToken: getAccessToken }),
    [getAccessToken],
  );

  const signer: TxSigner = {
    ensureWallet: () =>
      ensureStellarWallet({
        existingAddress: stellarAddressFromUser(user),
        createWallet: async () => {
          const created = await createWallet({ chainType: 'stellar' });
          return created.wallet.address;
        },
        registerWallet: (stellarAddress) => api.registerWallet({ stellarAddress }),
      }),
    sign: async (address, hash) => {
      const { signature } = await signRawHash({
        address,
        chainType: 'stellar',
        hash: hash as `0x${string}`,
      });
      return signature;
    },
  };

  return { api, signer, profile: profileFromUser(user), logout };
}
