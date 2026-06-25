import { Injectable } from '@nestjs/common';
import { VaultService } from '../vault/vault.service';
import { StellarService } from '../stellar/stellar.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { parseBaseUnits } from '../common/parse-money';
import { BuildTxResponse, SubmitTxDto } from '@fixearn/shared';

@Injectable()
export class DepositService {
  constructor(
    private readonly vault: VaultService,
    private readonly stellar: StellarService,
    private readonly ledger: LedgerService,
    private readonly wallet: WalletService,
  ) {}

  async build(companyId: string, amount: bigint): Promise<BuildTxResponse> {
    const address = await this.wallet.getAddress(companyId);
    const { xdr } = await this.vault.buildDeposit(address, amount);
    const { hash } = this.stellar.hashForSigning(xdr);
    return { xdr, hash };
  }

  async submit(
    companyId: string,
    dto: SubmitTxDto,
  ): Promise<{ txHash: string }> {
    const { txHash } = await this.stellar.attachAndSubmit(
      dto.xdr,
      dto.stellarAddress,
      dto.signatureHex,
    );
    await this.ledger.recordDeposit(
      companyId,
      parseBaseUnits(dto.amount),
      txHash,
    );
    return { txHash };
  }
}
