/**
 * Módulo: privy-token-cache
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-31
 * Intuito: A chave de verificação tem prazo e é buscada de novo se a assinatura falhar.
 * Sequência: quem já tem chave válida não espera o refetch; se o refetch já trocou a chave, a assinatura ruim usa essa chave sem outra busca; chave inválida não substitui a anterior.
 */
import { createRequire } from 'node:module';
import {
  emailFromLinkedAccounts,
  decodeJwtPayload,
  isSignatureFailure,
} from './identity-email';

const nodeRequire = createRequire(__filename);
const { importSPKI } = nodeRequire(
  nodeRequire.resolve('jose', {
    paths: [nodeRequire.resolve('@privy-io/server-auth')],
  }),
) as {
  importSPKI: (key: string, alg: string) => Promise<unknown>;
};

const KEY_FETCH_TIMEOUT_MS = 8_000;

/**
 * jose 4 importa o SPKI e não confere o algoritmo com o tipo da chave.
 * ES256 aqui é P-256; RSA e lixo não entram no cache.
 */
async function assertEs256VerificationKey(key: string): Promise<void> {
  const imported = (await importSPKI(key, 'ES256')) as {
    asymmetricKeyType?: string;
    asymmetricKeyDetails?: { namedCurve?: string };
  };
  if (
    imported.asymmetricKeyType !== 'ec' ||
    imported.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
  ) {
    throw new Error('chave do Privy inválida');
  }
}

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
      signal: AbortSignal.timeout(KEY_FETCH_TIMEOUT_MS),
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
  try {
    await assertEs256VerificationKey(body.verification_key);
  } catch {
    throw new Error('chave do Privy inválida');
  }
  return body.verification_key;
}

export function createPrivyTokenCache(
  client: PrivyTokenClient,
  options: PrivyTokenCacheOptions,
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

  function startKeyFetch(force: boolean): Promise<string> {
    if (keyPromise) return keyPromise;
    const previous = keyHit;
    const pending = fetchVerificationKey()
      .then(async (key) => {
        await assertEs256VerificationKey(key);
        keyHit = {
          key,
          fetchedAt: now(),
          refreshedAfterFailure: force,
        };
        return key;
      })
      .catch((error: unknown) => {
        if (previous) {
          keyHit = {
            key: previous.key,
            fetchedAt: now(),
            refreshedAfterFailure: true,
          };
          return previous.key;
        }
        throw error;
      })
      .finally(() => {
        if (keyPromise === pending) keyPromise = null;
      });
    keyPromise = pending;
    return pending;
  }

  function verificationKey(force = false): Promise<string> {
    if (!force && keyIsFresh()) return Promise.resolve(keyHit!.key);
    if (
      force &&
      keyHit?.refreshedAfterFailure &&
      now() < keyHit.fetchedAt + keyIntervalMs
    ) {
      return Promise.resolve(keyHit.key);
    }
    const pending = startKeyFetch(force);
    if (!force && keyHit) return Promise.resolve(keyHit.key);
    return pending;
  }

  async function verifyToken(
    token: string,
    key: string,
  ): Promise<{ privyUserId: string }> {
    const claims = await client.verifyAuthToken(token, key);
    return { privyUserId: claims.userId };
  }

  async function verifyWithKey(
    token: string,
  ): Promise<{ privyUserId: string }> {
    const key = await verificationKey();
    try {
      return await verifyToken(token, key);
    } catch (error) {
      if (!isSignatureFailure(error)) throw error;
      // O refetch do prazo pode ter terminado enquanto a assinatura da chave velha falhava.
      if (keyHit && keyHit.key !== key) {
        try {
          return await verifyToken(token, keyHit.key);
        } catch (retryError) {
          if (!isSignatureFailure(retryError)) throw retryError;
        }
      }
      const fresh = await verificationKey(true);
      if (fresh === key) throw error;
      return verifyToken(token, fresh);
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
