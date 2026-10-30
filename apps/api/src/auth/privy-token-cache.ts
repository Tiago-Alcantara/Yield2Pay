/**
 * Módulo: privy-token-cache
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: A chave de verificação tem prazo e é buscada de novo se a assinatura falhar.
 * Sequência: várias validações dividem a mesma busca; o e-mail fica num LRU com teto e não guarda nulo.
 */
import {
  emailFromLinkedAccounts,
  decodeJwtPayload,
  isSignatureFailure,
} from './identity-email';

export type PrivyTokenClient = {
  getVerificationKey: () => Promise<string>;
  verifyAuthToken: (
    token: string,
    verificationKeyOverride?: string,
  ) => Promise<{ userId: string }>;
  getUser: (userId: string) => Promise<{
    google?: { email?: string | null } | null;
    email?: { address?: string | null } | null;
  }>;
};

export type PrivyTokenCache = {
  verify: (token: string) => Promise<{ privyUserId: string }>;
  emailFromIdentity: (
    idToken: string,
    expectedUserId: string,
  ) => Promise<string | null>;
  getEmail: (privyUserId: string) => Promise<string | null>;
};

export type PrivyTokenCacheOptions = {
  keyTtlMs?: number;
  emailTtlMs?: number;
  emailCap?: number;
  now?: () => number;
};

const DEFAULT_KEY_TTL_MS = 10 * 60 * 1000;
const DEFAULT_EMAIL_TTL_MS = 10 * 60 * 1000;
const DEFAULT_EMAIL_CAP = 200;

type EmailHit = { value: string; expiresAt: number };

export function createPrivyTokenCache(
  client: PrivyTokenClient,
  options: PrivyTokenCacheOptions = {},
): PrivyTokenCache {
  const keyTtlMs = options.keyTtlMs ?? DEFAULT_KEY_TTL_MS;
  const emailTtlMs = options.emailTtlMs ?? DEFAULT_EMAIL_TTL_MS;
  const emailCap = options.emailCap ?? DEFAULT_EMAIL_CAP;
  const now = options.now ?? Date.now;
  let keyValue: { key: string; expiresAt: number } | null = null;
  let keyPromise: Promise<string> | null = null;
  const emails = new Map<string, EmailHit>();
  const inflight = new Map<string, Promise<string | null>>();

  function rememberKey(key: string): string {
    keyValue = { key, expiresAt: now() + keyTtlMs };
    keyPromise = null;
    return key;
  }

  function verificationKey(force = false): Promise<string> {
    if (!force && keyValue && keyValue.expiresAt > now()) {
      return Promise.resolve(keyValue.key);
    }
    if (!force && keyPromise) return keyPromise;
    keyValue = null;
    keyPromise = client
      .getVerificationKey()
      .then(rememberKey)
      .catch((error: unknown) => {
        keyPromise = null;
        throw error;
      });
    return keyPromise;
  }

  async function verifyWithKey(
    token: string,
  ): Promise<{ privyUserId: string }> {
    const key = await verificationKey();
    try {
      const claims = await client.verifyAuthToken(token, key);
      return { privyUserId: claims.userId };
    } catch (error) {
      if (!isSignatureFailure(error)) throw error;
      const fresh = await verificationKey(true);
      const claims = await client.verifyAuthToken(token, fresh);
      return { privyUserId: claims.userId };
    }
  }

  function rememberEmail(privyUserId: string, email: string): void {
    emails.delete(privyUserId);
    emails.set(privyUserId, { value: email, expiresAt: now() + emailTtlMs });
    while (emails.size > emailCap) {
      const oldest = emails.keys().next().value;
      if (oldest === undefined) break;
      emails.delete(oldest);
    }
  }

  return {
    verify: verifyWithKey,
    async emailFromIdentity(
      idToken: string,
      expectedUserId: string,
    ): Promise<string | null> {
      const claims = await verifyWithKey(idToken);
      if (claims.privyUserId !== expectedUserId) return null;
      return emailFromLinkedAccounts(decodeJwtPayload(idToken).linked_accounts);
    },
    getEmail(privyUserId: string): Promise<string | null> {
      const hit = emails.get(privyUserId);
      if (hit && hit.expiresAt > now()) {
        emails.delete(privyUserId);
        emails.set(privyUserId, hit);
        return Promise.resolve(hit.value);
      }
      if (hit) emails.delete(privyUserId);
      const pending = inflight.get(privyUserId);
      if (pending) return pending;
      const request = client
        .getUser(privyUserId)
        .then((user) => {
          inflight.delete(privyUserId);
          const raw = user.google?.email ?? user.email?.address ?? null;
          const email = raw ? raw.toLowerCase() : null;
          if (email) rememberEmail(privyUserId, email);
          return email;
        })
        .catch((error: unknown) => {
          inflight.delete(privyUserId);
          throw error;
        });
      inflight.set(privyUserId, request);
      return request;
    },
  };
}
