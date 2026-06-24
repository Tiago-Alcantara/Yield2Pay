import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [AppConfigModule, PrismaModule, WalletModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
