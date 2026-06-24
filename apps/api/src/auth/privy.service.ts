import { Inject, Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';

@Injectable()
export class PrivyService {
  private client: PrivyClient;
  constructor(@Inject(APP_CONFIG) cfg: Env) {
    this.client = new PrivyClient(cfg.privyAppId, cfg.privyAppSecret);
  }
  async verify(token: string): Promise<{ privyUserId: string }> {
    const claims = await this.client.verifyAuthToken(token);
    return { privyUserId: claims.userId };
  }
}
