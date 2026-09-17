import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VaultService } from '../vault/vault.service';
import { WalletService } from '../wallet/wallet.service';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';

/** Formata um número como percentual com sinal e 1 casa decimal (ex.: 3.2 → "+3.2"). */
function formatSignedPercent(n: number): string {
  const fixed = Math.abs(n).toFixed(1);
  return `${n < 0 ? '-' : '+'}${fixed}`;
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly wallet: WalletService,
    @Inject(APP_CONFIG) private readonly config: Env,
  ) {}

  async recordDeposit(
    companyId: string,
    amount: bigint,
    txHash: string,
    venueId = 'stellar:blend',
    rampOrderId?: string,
  ): Promise<void> {
    await this.prisma.deposit.create({
      data: { companyId, amount, txHash, venueId, rampOrderId },
    });
  }

  async recordWithdraw(
    companyId: string,
    amount: bigint,
    txHash: string,
    venueId = 'stellar:blend',
  ): Promise<void> {
    // Lançamento negativo: reduz o principal agregado em principal().
    await this.prisma.deposit.create({
      data: { companyId, amount: -amount, txHash, venueId },
    });
  }

  async principal(companyId: string, venueId?: string): Promise<bigint> {
    const principalVenueId = venueId ?? 'stellar:blend';
    const depositAggregate = await this.prisma.deposit.aggregate({
      where: { companyId, venueId: principalVenueId },
      _sum: { amount: true },
    });
    const sum = depositAggregate._sum.amount ?? 0n;
    return sum > 0n ? sum : 0n;
  }

  async computeSpendable(companyId: string, venueId?: string) {
    // getAddress e principal são consultas independentes ao DB → rodam em
    // paralelo. getPositionValue depende do address, então vem depois.
    // Vault read permanece Stellar-only; sem venue explícita, principal também
    // usa Stellar para nunca misturar unidades de 6 e 7 casas decimais.
    const [address, principal] = await Promise.all([
      this.wallet.getAddress(companyId),
      this.principal(companyId, venueId),
    ]);
    let vaultValue = await this.vault.getPositionValue(address);
    // Demo: injeta rendimento sintético quando DEMO_YIELD_BPS > 0, para
    // demonstrar rendimento já no primeiro mês (depósito recém-feito ainda
    // não rendeu). Em produção a flag fica 0 e nada muda.
    const demoBps = BigInt(this.config.demoYieldBps);
    if (demoBps > 0n && principal > 0n) {
      const synthetic = principal + (principal * demoBps) / 10000n;
      if (synthetic > vaultValue) vaultValue = synthetic;
    }
    const spendable = vaultValue > principal ? vaultValue - principal : 0n;
    return { vaultValue, principal, spendable };
  }

  /**
   * Variação percentual do rendimento (spendable) atual vs. ~1 mês atrás,
   * formatada como string com sinal (ex.: "+3.2", "-1.5"). Compara contra o
   * snapshot mais recente com pelo menos ~28 dias de idade.
   *
   * Retorna null quando não há base de comparação (sem histórico ou base zero),
   * exceto em modo demo (DEMO_YIELD_BPS > 0), onde cai num valor configurável
   * para a UI mostrar algo coerente já na primeira demonstração.
   */
  async getReturnsChangePercent(
    companyId: string,
    currentSpendable: bigint,
  ): Promise<string | null> {
    const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const baseline = await this.prisma.yieldSnapshot.findFirst({
      where: { companyId, createdAt: { lte: cutoff } },
      orderBy: { createdAt: 'desc' },
      select: { spendable: true },
    });

    if (!baseline || baseline.spendable <= 0n) {
      // Sem histórico utilizável: só inventa valor em modo demo.
      if (this.config.demoYieldBps <= 0) return null;
      const n = Number(this.config.demoReturnsChangePercent);
      if (!Number.isFinite(n)) return null;
      return formatSignedPercent(n);
    }

    // delta/base * 100, em décimos de % (1 casa decimal) com bigint.
    const tenths = ((currentSpendable - baseline.spendable) * 1000n) / baseline.spendable;
    const sign = tenths >= 0n ? '+' : '-';
    const abs = tenths < 0n ? -tenths : tenths;
    return `${sign}${abs / 10n}.${abs % 10n}`;
  }

  async snapshot(companyId: string): Promise<void> {
    const { vaultValue, principal, spendable } =
      await this.computeSpendable(companyId);
    await this.prisma.yieldSnapshot.create({
      data: { companyId, vaultValue, principal, spendable },
    });
  }
}
