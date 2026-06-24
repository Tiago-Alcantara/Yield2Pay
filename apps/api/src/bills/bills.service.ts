import { Injectable } from '@nestjs/common';
import type { CreateBillDto } from '@fixearn/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateBillDto) {
    return this.prisma.recurringBill.create({
      data: { companyId, vendor: dto.vendor, monthlyCost: BigInt(dto.monthlyCost), type: dto.type },
    });
  }

  list(companyId: string) {
    return this.prisma.recurringBill.findMany({ where: { companyId } });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.prisma.recurringBill.deleteMany({ where: { id, companyId } });
  }
}
