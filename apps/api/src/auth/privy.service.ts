import { Inject, Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';

@Injectable()
export class PrivyService {
  private client: PrivyClient;
  constructor(@Inject(APP_CONFIG) config: Env) {
    this.client = new PrivyClient(config.privyAppId, config.privyAppSecret);
  }
  async verify(token: string): Promise<{ privyUserId: string }> {
    const claims = await this.client.verifyAuthToken(token);
    return { privyUserId: claims.userId };
  }

  async getEmail(privyUserId: string): Promise<string | null> {
    const user = await this.client.getUser(privyUserId);
    const raw = user.google?.email ?? user.email?.address;
    return raw ? raw.toLowerCase() : null;
  }
}
