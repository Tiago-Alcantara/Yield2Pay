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
  fetchVerificationKey: () => Promise<string>;
  /** No máximo uma busca neste intervalo. O padrão fica entre 30 s e 60 s. */
  keyIntervalMs?: number;
  emailTtlMs?: number;
  emailCap?: number;
  now?: () => number;
};

const DEFAULT_KEY_INTERVAL_MS = 45_000;
const DEFAULT_EMAIL_TTL_MS = 10 * 60 * 1000;
const DEFAULT_EMAIL_CAP = 200;

type EmailHit = { value: string; expiresAt: number };
type KeyHit = {
  key: string;
  fetchedAt: number;
  /** Já houve um refetch por assinatura ruim neste prazo. */
  refreshedAfterFailure: boolean;
};

/** Busca a chave no HTTP do Privy, fora do cache eterno do SDK. */
export async function fetchPrivyVerificationKey(
  appId: string,
  appSecret: string,
): Promise<string> {
  const base = process.env.PRIVY_API_URL || 'https://auth.privy.io';
  const response = await fetch(
    `${base}/api/v1/apps/${encodeURIComponent(appId)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
        'privy-app-id': appId,
        'privy-client': 'server-auth:1.32.5',
      },
    },
  );
  if (!response.ok) throw new Error('falha ao buscar a chave do Privy');
  const body = (await response.json()) as { verification_key?: unknown };
  if (typeof body.verification_key !== 'string' || !body.verification_key) {
    throw new Error('chave do Privy ausente');
  }
  return body.verification_key;
}

export function createPrivyTokenCache(
  client: PrivyTokenClient,
  options: PrivyTokenCacheOptions = {},
): PrivyTokenCache {
  const keyIntervalMs = options.keyIntervalMs ?? DEFAULT_KEY_INTERVAL_MS;
  const emailTtlMs = options.emailTtlMs ?? DEFAULT_EMAIL_TTL_MS;
  const emailCap = options.emailCap ?? DEFAULT_EMAIL_CAP;
  const now = options.now ?? Date.now;
  const fetchVerificationKey = options.fetchVerificationKey;
  let keyHit: KeyHit | null = null;
  let keyPromise: Promise<string> | null = null;
  const emails = new Map<string, EmailHit>();
  const inflight = new Map<string, Promise<string | null>>();

  function keyIsFresh(): boolean {
    return !!keyHit && now() < keyHit.fetchedAt + keyIntervalMs;
  }

  function verificationKey(force = false): Promise<string> {
    if (keyPromise) return keyPromise;
    if (!force && keyIsFresh()) return Promise.resolve(keyHit!.key);
    if (
      force &&
      keyHit?.refreshedAfterFailure &&
      now() < keyHit.fetchedAt + keyIntervalMs
    ) {
      return Promise.resolve(keyHit.key);
    }
    const previous = keyHit;
    keyPromise = fetchVerificationKey()
      .then((key) => {
        keyHit = {
          key,
          fetchedAt: now(),
          refreshedAfterFailure: force,
        };
        keyPromise = null;
        return key;
      })
      .catch((error: unknown) => {
        keyPromise = null;
        if (previous) {
          keyHit = {
            key: previous.key,
            fetchedAt: now(),
            refreshedAfterFailure: true,
          };
          return previous.key;
        }
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
      if (fresh === key) throw error;
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
