import { Inject, Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';

// Mesmo valor enviado pelo painel quando o Privy não está configurado
// (apps/web/src/app/family/_lib/localSession.ts).
const LOCAL_DEV_TOKEN = 'yield2pay-local-dev';
const LOCAL_DEV_USER_ID = 'did:privy:local-dev';
const LOCAL_DEV_EMAIL = 'familia@localhost';

@Injectable()
export class PrivyService {
  private client: PrivyClient;
  private readonly localSession: boolean;
  constructor(@Inject(APP_CONFIG) config: Env) {
    this.localSession = config.localSession;
    this.client = new PrivyClient(config.privyAppId, config.privyAppSecret);
  }
  async verify(token: string): Promise<{ privyUserId: string }> {
    if (this.localSession && token === LOCAL_DEV_TOKEN) {
      return { privyUserId: LOCAL_DEV_USER_ID };
    }
    const claims = await this.client.verifyAuthToken(token);
    return { privyUserId: claims.userId };
  }

  async getEmail(privyUserId: string): Promise<string | null> {
    if (privyUserId === LOCAL_DEV_USER_ID) return LOCAL_DEV_EMAIL;
    const user = await this.client.getUser(privyUserId);
    const raw = user.google?.email ?? user.email?.address;
    return raw ? raw.toLowerCase() : null;
  }
}
