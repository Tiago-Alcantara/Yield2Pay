import { Inject, Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';
import { createPrivyTokenCache, type PrivyTokenCache } from './privy-token-cache';

// Mesmo valor enviado pelo painel quando o Privy não está configurado
// (apps/web/src/app/(family)/_lib/localSession.ts).
const LOCAL_DEV_TOKEN = 'yield2pay-local-dev';
const LOCAL_DEV_USER_ID = 'did:privy:local-dev';
const LOCAL_DEV_EMAIL = 'familia@localhost';

@Injectable()
export class PrivyService {
  private client: PrivyClient;
  private readonly localSession: boolean;
  private readonly tokens: PrivyTokenCache;
  constructor(@Inject(APP_CONFIG) config: Env) {
    this.localSession = config.localSession;
    this.client = new PrivyClient(config.privyAppId, config.privyAppSecret);
    this.tokens = createPrivyTokenCache(this.client);
  }
  async verify(token: string): Promise<{ privyUserId: string }> {
    if (this.localSession && token === LOCAL_DEV_TOKEN) {
      return { privyUserId: LOCAL_DEV_USER_ID };
    }
    return this.tokens.verify(token);
  }

  async getEmail(privyUserId: string): Promise<string | null> {
    if (privyUserId === LOCAL_DEV_USER_ID) return LOCAL_DEV_EMAIL;
    return this.tokens.getEmail(privyUserId);
  }
}
