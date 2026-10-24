import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/config.module';
import { isFinancialProductEnabled } from './config/financial-product';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { WalletModule } from './wallet/wallet.module';
import { VaultModule } from './vault/vault.module';
import { LedgerModule } from './ledger/ledger.module';
import { StellarModule } from './stellar/stellar.module';
import { DepositModule } from './deposit/deposit.module';
import { WithdrawModule } from './withdraw/withdraw.module';
import { BillsModule } from './bills/bills.module';
import { JobsModule } from './jobs/jobs.module';
import { RampModule } from './ramp/ramp.module';
import { HouseholdModule } from './household/household.module';
import { StatementsModule } from './statements/statements.module';
import { ExpensesModule } from './expenses/expenses.module';
import { SummaryModule } from './summary/summary.module';
import { LessonsModule } from './lessons/lessons.module';

/** Cofre, carteira, depósito, saque, ramp, Stellar e ledger. Fora do grafo com a flag desligada. */
export function financialModules(raw: Record<string, string | undefined> = process.env) {
  if (!isFinancialProductEnabled(raw)) return [];
  return [
    WalletModule,
    VaultModule,
    LedgerModule,
    StellarModule,
    DepositModule,
    WithdrawModule,
    JobsModule,
    RampModule,
  ];
}

export function appImports(raw: Record<string, string | undefined> = process.env) {
  return [
    ScheduleModule.forRoot(),
    AppConfigModule,
    PrismaModule,
    ...financialModules(raw),
    BillsModule,
    HouseholdModule,
    StatementsModule,
    ExpensesModule,
    SummaryModule,
    LessonsModule,
  ];
}

@Module({
  imports: appImports(),
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
