/**
 * Módulo: privy-token-cache
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: A chave de verificação e o e-mail saem uma vez e ficam na memória.
 * Sequência: várias validações dividem a mesma busca da chave e passam essa chave ao Privy.
 */

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
  getEmail: (privyUserId: string) => Promise<string | null>;
};

export function createPrivyTokenCache(client: PrivyTokenClient): PrivyTokenCache {
  let keyPromise: Promise<string> | null = null;
  const emails = new Map<string, Promise<string | null>>();

  function verificationKey(): Promise<string> {
    if (!keyPromise) {
      keyPromise = client.getVerificationKey().catch((error: unknown) => {
        keyPromise = null;
        throw error;
      });
    }
    return keyPromise;
  }

  return {
    async verify(token: string): Promise<{ privyUserId: string }> {
      const key = await verificationKey();
      if (!key) {
        keyPromise = null;
        throw new Error('missing verification key');
      }
      const claims = await client.verifyAuthToken(token, key);
      return { privyUserId: claims.userId };
    },
    getEmail(privyUserId: string): Promise<string | null> {
      const cached = emails.get(privyUserId);
      if (cached) return cached;
      const pending = client
        .getUser(privyUserId)
        .then((user) => {
          const raw = user.google?.email ?? user.email?.address ?? null;
          return raw ? raw.toLowerCase() : null;
        })
        .catch((error: unknown) => {
          emails.delete(privyUserId);
          throw error;
        });
      emails.set(privyUserId, pending);
      return pending;
    },
  };
}
