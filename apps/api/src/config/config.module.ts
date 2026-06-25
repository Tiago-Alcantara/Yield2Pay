import { Global, Module } from '@nestjs/common';
import { loadEnv, Env } from './env';

export const APP_CONFIG = 'APP_CONFIG';

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: (): Env => loadEnv(process.env) },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
