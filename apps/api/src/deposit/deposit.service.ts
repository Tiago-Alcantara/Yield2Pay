import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { VaultService } from '../vault/vault.service';
import { StellarService } from '../stellar/stellar.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { parseBaseUnits } from '../common/parse-money';
import { BuildTxResponse, SubmitTxDto } from '@yield2pay/shared';

// Testnet safety cap: the sponsor funds each deposit (fundClient), so an
// unbounded amount would let an authenticated caller drain the sponsor in a
// single request. Bound it well above expected deposits (10000 XLM). Adjust to
// the real product limit later.
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
    const address = await this.wallet.getAddress(companyId);
    // Abastece a wallet do cliente com o valor do depósito (sponsor → cliente)
    // ANTES de montar o XDR: a build da DeFindex simula o invoke Soroban e
    // exige que o saldo já esteja na conta do cliente.
    await this.stellar.fundClient(address, amount);
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
    );
    return { txHash };
  }
}
