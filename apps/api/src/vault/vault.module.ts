import { Module } from '@nestjs/common';
import { DefindexSDK } from '@defindex/sdk';
import { VaultService, DEFINDEX_SDK } from './vault.service';
import { APP_CONFIG } from '../config/config.module';
import { Env } from '../config/env';

@Module({
  providers: [
    {
      provide: DEFINDEX_SDK,
      useFactory: (cfg: Env) =>
        new DefindexSDK({
          apiKey: cfg.defindexApiKey,
          baseUrl: cfg.defindexBaseUrl,
        }),
      inject: [APP_CONFIG],
    },
    VaultService,
  ],
  exports: [VaultService],
})
export class VaultModule {}
