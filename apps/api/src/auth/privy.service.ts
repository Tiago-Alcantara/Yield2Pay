import { Inject, Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';
import {
  createPrivyTokenCache,
  fetchPrivyVerificationKey,
  type PrivyTokenCache,
} from './privy-token-cache';

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
    this.tokens = createPrivyTokenCache(this.client, {
      fetchVerificationKey: () =>
        fetchPrivyVerificationKey(config.privyAppId, config.privyAppSecret),
    });
  }
  async verify(
    token: string,
  ): Promise<{ privyUserId: string; email: string | null }> {
    if (this.localSession && token === LOCAL_DEV_TOKEN) {
      return { privyUserId: LOCAL_DEV_USER_ID, email: LOCAL_DEV_EMAIL };
    }
    const claims = await this.tokens.verify(token);
    return { privyUserId: claims.privyUserId, email: null };
  }

  async emailFromIdentity(
    idToken: string,
    expectedUserId: string,
  ): Promise<string | null> {
    return this.tokens.emailFromIdentity(idToken, expectedUserId);
  }

  async getEmail(privyUserId: string): Promise<string | null> {
    if (privyUserId === LOCAL_DEV_USER_ID) return LOCAL_DEV_EMAIL;
    return this.tokens.getEmail(privyUserId);
  }
}
