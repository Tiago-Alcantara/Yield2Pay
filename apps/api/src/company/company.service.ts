import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  // upsert é atômico: resolve a corrida TOCTOU entre logins simultâneos do mesmo
  // privyUserId (a unique constraint garante uma única company).
  async findOrCreate(privyUserId: string): Promise<{ id: string }> {
    return this.prisma.company.upsert({
      where: { privyUserId },
      create: { privyUserId },
      update: {},
    });
  }
}
