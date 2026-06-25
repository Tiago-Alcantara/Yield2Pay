import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class SnapshotJob {
  private readonly log = new Logger(SnapshotJob.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduled() {
    await this.runOnce();
  }

  async runOnce(): Promise<{ count: number }> {
    const companies = await this.prisma.company.findMany({
      where: { wallet: { isNot: null } },
      select: { id: true },
    });
    // Snapshots de companies diferentes são independentes → rodam em paralelo.
    // allSettled: uma falha não derruba as demais; contamos só os sucessos.
    // (Se a base de companies crescer muito, limitar a concorrência em lotes
    // para não saturar o RPC/vault de uma vez.)
    const results = await Promise.allSettled(
      companies.map((company) => this.ledger.snapshot(company.id)),
    );
    let count = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        count++;
      } else {
        this.log.error(
          `snapshot failed for ${companies[index].id}: ${String(result.reason)}`,
        );
      }
    });
    return { count };
  }
}
