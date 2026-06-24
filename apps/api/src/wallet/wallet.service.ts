import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async register(companyId: string, stellarAddress: string) {
    return this.prisma.wallet.upsert({
      where: { companyId },
      create: { companyId, stellarAddress },
      update: { stellarAddress },
    });
  }

  async getAddress(companyId: string): Promise<string> {
    const w = await this.prisma.wallet.findUnique({ where: { companyId } });
    if (!w) throw new NotFoundException('wallet not registered');
    return w.stellarAddress;
  }
}
