import { Module } from '@nestjs/common';
import { VenueRegistry, resolveVenueMode } from '@yield2pay/venue-core';
import { createStellarBlendPlugin } from '@yield2pay/venue-stellar-blend';
import { createSolanaKaminoPlugin } from '@yield2pay/venue-solana-kamino';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';
import { venueModeEnv } from '../config/env';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { LedgerModule } from '../ledger/ledger.module';
import { VaultModule } from '../vault/vault.module';
import { StellarModule } from '../stellar/stellar.module';
import { StellarDefindexLiveAdapter } from './stellar-live.adapter';
import { VenueService } from './venue.service';
import { VenueController } from './venue.controller';
import { AccountChainController } from './account-chain.controller';
import { VENUE_REGISTRY } from './venue.tokens';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    WalletModule,
    LedgerModule,
    VaultModule,
    StellarModule,
  ],
  controllers: [VenueController, AccountChainController],
  providers: [
    StellarDefindexLiveAdapter,
    {
      provide: VENUE_REGISTRY,
      useFactory: (
        config: Env,
        stellarLive: StellarDefindexLiveAdapter,
      ): VenueRegistry => {
        const env = venueModeEnv(config);
        const registry = new VenueRegistry();
        const stellarMode = resolveVenueMode('stellar', env);
        const solanaMode = resolveVenueMode('solana', {
          ...env,
          VENUE_MODE: env.SOLANA_VENUE_MODE ?? 'mock',
        });
        registry.register(
          createStellarBlendPlugin({
            env,
            live: stellarMode === 'live' ? stellarLive : undefined,
          }),
        );
        registry.register(createSolanaKaminoPlugin({ env, mode: solanaMode }));
        return registry;
      },
      inject: [APP_CONFIG, StellarDefindexLiveAdapter],
    },
    VenueService,
  ],
  exports: [VenueService, VENUE_REGISTRY],
})
export class VenueModule {}
