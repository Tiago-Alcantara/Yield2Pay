import { toBaseUnits, type OfframpResult, type OnrampResult } from '@yield2pay/shared';
import type { YieldApi } from '../api/client';

export interface TxSigner {
  ensureWallet(): Promise<string>;
  sign(address: string, hash: string): Promise<string>;
}

export interface BiometricGate {
  confirm(message: string): Promise<void>;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function truncateTo7(value: string): string {
  const [whole, frac = ''] = value.split('.');
  return frac ? `${whole}.${frac.slice(0, 7)}` : whole;
}

export function createDepositJourney(sleep: (ms: number) => Promise<void> = delay) {
  let order: OnrampResult | null = null;
  let claimed = false;

  return {
    getOrder: () => order,
    reset() {
      order = null;
      claimed = false;
    },
    async start(
      api: YieldApi,
      profile: { email: string; displayName: string },
      amountFiat: string,
    ): Promise<OnrampResult> {
      const status = await api.getRampStatus();
      if (!status.ready) await api.rampSetup(profile);
      order = await api.startOnramp({ amountFiat });
      claimed = false;
      return order;
    },
    async waitForFiat(api: YieldApi, simulate = false): Promise<'funded' | 'pending'> {
      if (!order) throw new Error('Comece um depósito antes.');
      if (simulate) await api.simulateFiatReceived({ orderId: order.orderId });
      for (let i = 0; i < 20; i++) {
        const status = await api.getRampOrder(order.orderId);
        if (status.status === 'completed') return 'funded';
        await sleep(3000);
      }
      return 'pending';
    },
    async confirm(api: YieldApi, signer: TxSigner, biometric: BiometricGate): Promise<string> {
      if (!order) throw new Error('Comece um depósito antes.');
      await biometric.confirm('Confirme para guardar o depósito no cofre');
      const address = await signer.ensureWallet();

      if (!claimed) {
        const claim = await api.getOrderClaim(order.orderId);
        if (!claim.skip && claim.xdr && claim.hash) {
          const signature = await signer.sign(address, claim.hash);
          await api.submitOrderClaim(order.orderId, {
            xdr: claim.xdr,
            signatureHex: signature,
            stellarAddress: address,
          });
        }
        claimed = true;
      }

      const baseUnits = toBaseUnits(truncateTo7(order.targetAmount));
      const built = await api.buildDeposit(baseUnits);
      const signature = await signer.sign(address, built.hash);
      const submitted = await api.submitDeposit({
        xdr: built.xdr,
        signatureHex: signature,
        stellarAddress: address,
        amount: baseUnits,
        rampOrderId: order.orderId,
      });
      return submitted.txHash;
    },
  };
}

export function createWithdrawJourney(sleep: (ms: number) => Promise<void> = delay) {
  let order: OfframpResult | null = null;
  let withdrawn = false;

  return {
    getOrder: () => order,
    reset() {
      order = null;
      withdrawn = false;
    },
    async start(
      api: YieldApi,
      signer: TxSigner,
      biometric: BiometricGate,
      profile: { email: string; displayName: string },
      amountUsdc: string,
    ): Promise<{ order: OfframpResult; burnSigned: boolean }> {
      await biometric.confirm('Confirme para sacar');
      const address = await signer.ensureWallet();
      const baseUnits = toBaseUnits(amountUsdc);

      const status = await api.getRampStatus();
      if (!status.ready) await api.rampSetup(profile);

      if (!withdrawn) {
        const built = await api.buildWithdraw(baseUnits);
        const signature = await signer.sign(address, built.hash);
        await api.submitWithdraw({
          xdr: built.xdr,
          signatureHex: signature,
          stellarAddress: address,
          amount: baseUnits,
        });
        withdrawn = true;
      }

      if (!order) {
        order = await api.startOfframp({ amountToken: amountUsdc });
      }

      let burn = await api.getOrderBurn(order.orderId);
      for (let i = 0; i < 10 && !burn.ready; i++) {
        await sleep(3000);
        burn = await api.getOrderBurn(order.orderId);
      }

      let burnSigned = false;
      if (burn.ready && burn.xdr && burn.hash) {
        const signature = await signer.sign(address, burn.hash);
        await api.submitOrderBurn(order.orderId, {
          xdr: burn.xdr,
          signatureHex: signature,
          stellarAddress: address,
        });
        burnSigned = true;
      }

      return { order, burnSigned };
    },
  };
}
