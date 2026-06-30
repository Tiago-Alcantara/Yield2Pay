import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
