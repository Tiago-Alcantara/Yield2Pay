import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StrKey } from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { RESERVE_BUFFER_BASE_UNITS } from '../common/reserve';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
  ) {}

  async register(companyId: string, stellarAddress: string) {
    if (!StrKey.isValidEd25519PublicKey(stellarAddress)) {
      throw new BadRequestException('invalid stellar address');
    }
    // Fund on-chain first; only persist once the account is live.
    await this.stellar.ensureAccountFunded(stellarAddress);
    return this.prisma.wallet.upsert({
      where: { companyId },
      create: { companyId, stellarAddress },
      update: { stellarAddress },
    });
  }

  async getAddress(companyId: string): Promise<string> {
    const wallet = await this.prisma.wallet.findUnique({ where: { companyId } });
    if (!wallet) throw new NotFoundException('wallet not registered');
    return wallet.stellarAddress;
  }

  async getSolanaAddress(companyId: string): Promise<string | null> {
    const wallet = await this.prisma.wallet.findUnique({ where: { companyId } });
    if (!wallet) throw new NotFoundException('wallet not registered');
    return wallet.solanaAddress;
  }

  async getBalance(
    companyId: string,
  ): Promise<{ balance: string; spendable: string }> {
    const address = await this.getAddress(companyId);
    const balance = await this.stellar.getNativeBalance(address);
    const spendable =
      balance > RESERVE_BUFFER_BASE_UNITS
        ? balance - RESERVE_BUFFER_BASE_UNITS
        : 0n;
    return { balance: balance.toString(), spendable: spendable.toString() };
  }
}
