import { Injectable } from '@nestjs/common';
import { VaultService } from '../vault/vault.service';
import { StellarService } from '../stellar/stellar.service';
import { WalletService } from '../wallet/wallet.service';
import { BuildTxResponse, SubmitTxDto } from '@fixearn/shared';

@Injectable()
export class WithdrawService {
  constructor(
    private readonly vault: VaultService,
    private readonly stellar: StellarService,
    private readonly wallet: WalletService,
  ) {}

  async build(companyId: string, amount: bigint): Promise<BuildTxResponse> {
    const address = await this.wallet.getAddress(companyId);
    const { xdr } = await this.vault.buildWithdraw(address, amount);
    const { hash } = this.stellar.hashForSigning(xdr);
    return { xdr, hash };
  }

  async submit(_companyId: string, dto: SubmitTxDto): Promise<{ txHash: string }> {
    return this.stellar.attachAndSubmit(dto.xdr, dto.stellarAddress, dto.signatureHex);
  }
}
