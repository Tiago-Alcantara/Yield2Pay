'use client';

import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { usePrivy } from '@privy-io/react-auth';
import { useWallet } from './useWallet';
import { createApi } from './api';

export type VenueIdPath = { chain: 'stellar' | 'solana'; protocol: string };

const DEFAULT_VENUE: VenueIdPath = { chain: 'stellar', protocol: 'blend' };

/**
 * Assina no Privy conforme a chain do venue. O web não importa SDK de chain.
 * Stellar: hash + signRawHash. Solana mock: reenvia o envelope base64.
 */
export function useVenueTx(venue: VenueIdPath = DEFAULT_VENUE): {
  deposit(amountBaseUnits: string): Promise<string>;
  withdraw(amountBaseUnits: string): Promise<string>;
} {
  const { getAccessToken } = usePrivy();
  const { ensureWallet } = useWallet();
  const { signRawHash } = useSignRawHash();
  const api = createApi(getAccessToken);

  async function run(
    kind: 'deposit' | 'withdraw',
    amountBaseUnits: string,
  ): Promise<string> {
    const address = await ensureWallet();
    const build =
      kind === 'deposit'
        ? api.buildVenueDeposit
        : api.buildVenueWithdraw;
    const submit =
      kind === 'deposit'
        ? api.submitVenueDeposit
        : api.submitVenueWithdraw;

    const unsigned = await build(venue, amountBaseUnits);

    if (venue.chain === 'stellar') {
      if (!('xdr' in unsigned) || !('hash' in unsigned)) {
        throw new Error('expected stellar unsigned tx');
      }
      const { signature } = await signRawHash({
        address,
        chainType: 'stellar',
        hash: unsigned.hash as `0x${string}`,
      });
      const { txHash } = await submit(venue, {
        amount: amountBaseUnits,
        xdr: unsigned.xdr,
        signatureHex: signature,
        stellarAddress: address,
        address,
      });
      return txHash;
    }

    if (!('transactionBase64' in unsigned)) {
      throw new Error('expected solana unsigned tx');
    }
    const { txHash } = await submit(venue, {
      amount: amountBaseUnits,
      signedTransactionBase64: unsigned.transactionBase64,
    });
    return txHash;
  }

  return {
    deposit: (amount) => run('deposit', amount),
    withdraw: (amount) => run('withdraw', amount),
  };
}
