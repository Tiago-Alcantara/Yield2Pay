import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/config.module';
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

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AppConfigModule,
    PrismaModule,
    WalletModule,
    VaultModule,
    LedgerModule,
    StellarModule,
    DepositModule,
    WithdrawModule,
    BillsModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
