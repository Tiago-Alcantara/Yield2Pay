import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
    // Rate limit global: teto brando por IP em toda a API. Roda como APP_GUARD,
    // que executa ANTES do AuthGuard de cada controller — corta flood antes de
    // chegar no Privy/DB. Rotas caras (fund/register/submit) apertam ainda mais
    // via @Throttle no controller. Storage em memória: OK para instância única
    // (Render). Múltiplas instâncias → trocar por storage compartilhado (Redis).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
    }),
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
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
