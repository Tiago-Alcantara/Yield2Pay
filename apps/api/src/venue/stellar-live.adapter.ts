import { Injectable } from '@nestjs/common';
import type { StellarLiveAdapter } from '@yield2pay/venue-core';
import { VaultService } from '../vault/vault.service';
import { StellarService } from '../stellar/stellar.service';

/**
 * DeFindex + fee-bump ficam atrás desta porta. O plugin Stellar não importa
 * `@stellar/stellar-sdk` nem `@defindex/sdk`.
 */
@Injectable()
export class StellarDefindexLiveAdapter implements StellarLiveAdapter {
  constructor(
    private readonly vault: VaultService,
    private readonly stellar: StellarService,
  ) {}

  async buildDeposit(owner: string, amount: bigint) {
    const { xdr } = await this.vault.buildDeposit(owner, amount);
    const { hash } = this.stellar.hashForSigning(xdr);
    return { xdr, hash };
  }

  async buildWithdraw(owner: string, amount: bigint) {
    const { xdr } = await this.vault.buildWithdraw(owner, amount);
    const { hash } = this.stellar.hashForSigning(xdr);
    return { xdr, hash };
  }

  async submit(xdr: string, address: string, signatureHex: string) {
    const { txHash } = await this.stellar.attachAndSubmit(
      xdr,
      address,
      signatureHex,
    );
    return { txRef: txHash };
  }

  getApyPercent() {
    return this.vault.getApyPercent();
  }

  getPositionValue(owner: string) {
    return this.vault.getPositionValue(owner);
  }
}
