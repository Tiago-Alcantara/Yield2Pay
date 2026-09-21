import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CompanyAccountExport = {
  company: { id: string; privyUserId: string; createdAt: Date };
  bills: Array<{
    id: string;
    vendor: string;
    monthlyCost: string;
    type: string;
    status: string;
    createdAt: Date;
  }>;
  deposits: Array<{
    id: string;
    amount: string;
    txHash: string;
    createdAt: Date;
  }>;
};

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  // Prisma upsert é SELECT-depois-INSERT: dois primeiros-logins simultâneos do
  // mesmo privyUserId podem ambos não achar a linha e correr no INSERT — um
  // ganha, o outro toma unique-constraint violation (P2002). Captura e re-lê:
  // a unique constraint garante que a linha já existe nesse ponto.
  async findOrCreate(privyUserId: string): Promise<{ id: string }> {
    try {
      return await this.prisma.company.upsert({
        where: { privyUserId },
        create: { privyUserId },
        update: {},
      });
    } catch (e) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code?: string }).code === 'P2002'
      ) {
        return this.prisma.company.findUniqueOrThrow({ where: { privyUserId } });
      }
      throw e;
    }
  }

  async exportAccount(companyId: string): Promise<CompanyAccountExport> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { id: true, privyUserId: true, createdAt: true },
    });
    const bills = await this.prisma.recurringBill.findMany({
      where: { companyId },
      select: {
        id: true,
        vendor: true,
        monthlyCost: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });
    const deposits = await this.prisma.deposit.findMany({
      where: { companyId },
      select: { id: true, amount: true, txHash: true, createdAt: true },
    });
    return {
      company,
      bills: bills.map((bill) => ({
        ...bill,
        monthlyCost: bill.monthlyCost.toString(),
      })),
      deposits: deposits.map((deposit) => ({
        ...deposit,
        amount: deposit.amount.toString(),
      })),
    };
  }

  async deleteAccount(companyId: string): Promise<void> {
    const depositCount = await this.prisma.deposit.count({
      where: { companyId },
    });
    if (depositCount > 0) {
      throw new ForbiddenException(
        'account has deposits; withdraw before deleting',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const childWhere = { where: { companyId } };
      await tx.recurringBill.deleteMany(childWhere);
      await tx.yieldSnapshot.deleteMany(childWhere);
      await tx.rampOrder.deleteMany(childWhere);
      await tx.etherfuseCustomer.deleteMany(childWhere);
      await tx.wallet.deleteMany(childWhere);
      await tx.deposit.deleteMany(childWhere);
      await tx.company.delete({ where: { id: companyId } });
    });
  }
}
