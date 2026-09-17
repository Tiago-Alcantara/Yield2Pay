import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { VaultService } from '../vault/vault.service';
import { StellarService } from '../stellar/stellar.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { parseBaseUnits } from '../common/parse-money';
import { BuildTxResponse, SubmitTxDto } from '@yield2pay/shared';

// Safety cap on a single deposit. Bound it well above expected deposits
// (10000 XLM); adjust to the real product limit later.
const MAX_DEPOSIT_BASE_UNITS = 100_000_000_000n; // 10000 XLM (7 decimals)

@Injectable()
export class DepositService {
  constructor(
    private readonly vault: VaultService,
    private readonly stellar: StellarService,
    private readonly ledger: LedgerService,
    private readonly wallet: WalletService,
  ) {}

  async build(companyId: string, amount: bigint): Promise<BuildTxResponse> {
    if (amount > MAX_DEPOSIT_BASE_UNITS) {
      throw new BadRequestException('amount exceeds maximum deposit');
    }
    // Cofre USDC: o valor vem do on-ramp (USDC recebido), não do saldo XLM
    // nativo. Não checamos saldo nativo aqui — o depósito falha on-chain se a
    // carteira não tiver USDC. O buffer de XLM segue só p/ fees/reserve.
    const address = await this.wallet.getAddress(companyId);
    const { xdr } = await this.vault.buildDeposit(address, amount);
    const { hash } = this.stellar.hashForSigning(xdr);
    return { xdr, hash };
  }

  async submit(
    companyId: string,
    dto: SubmitTxDto,
  ): Promise<{ txHash: string }> {
    const registered = await this.wallet.getAddress(companyId);
    if (dto.stellarAddress !== registered) {
      throw new ForbiddenException('stellar address does not match registered wallet');
    }
    const { txHash } = await this.stellar.attachAndSubmit(
      dto.xdr,
      dto.stellarAddress,
      dto.signatureHex,
    );
    await this.ledger.recordDeposit(
      companyId,
      parseBaseUnits(dto.amount),
      txHash,
      'stellar:blend',
      dto.rampOrderId,
    );
    return { txHash };
  }
}
