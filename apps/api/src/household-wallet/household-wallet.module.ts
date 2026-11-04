import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdModule } from '../household/household.module';
import { HouseholdWalletController } from './household-wallet.controller';
import { HouseholdWalletService } from './household-wallet.service';
import { WalletGateway } from './wallet-gateway';
import { WalletPricesService } from './wallet-prices.service';
import { WalletSyncService } from './wallet-sync.service';

/** Só leitura e sem segredo: fica fora da flag do produto financeiro. */
@Module({
  imports: [AuthModule, HouseholdModule],
  providers: [
    WalletGateway,
    WalletPricesService,
    WalletSyncService,
    HouseholdWalletService,
  ],
  controllers: [HouseholdWalletController],
})
export class HouseholdWalletModule {}
