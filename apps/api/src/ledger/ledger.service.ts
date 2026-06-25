import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly wallet: WalletService,
  ) {}

  async recordDeposit(
    companyId: string,
    amount: bigint,
    txHash: string,
  ): Promise<void> {
    await this.prisma.deposit.create({ data: { companyId, amount, txHash } });
  }

  async principal(companyId: string): Promise<bigint> {
    const depositAggregate = await this.prisma.deposit.aggregate({
      where: { companyId },
      _sum: { amount: true },
    });
    return depositAggregate._sum.amount ?? 0n;
  }

  async computeSpendable(companyId: string) {
    // getAddress e principal são consultas independentes ao DB → rodam em
    // paralelo. getPositionValue depende do address, então vem depois.
    const [address, principal] = await Promise.all([
      this.wallet.getAddress(companyId),
      this.principal(companyId),
    ]);
    const vaultValue = await this.vault.getPositionValue(address);
    const spendable = vaultValue > principal ? vaultValue - principal : 0n;
    return { vaultValue, principal, spendable };
  }

  async snapshot(companyId: string): Promise<void> {
    const { vaultValue, principal, spendable } =
      await this.computeSpendable(companyId);
    await this.prisma.yieldSnapshot.create({
      data: { companyId, vaultValue, principal, spendable },
    });
  }
}
