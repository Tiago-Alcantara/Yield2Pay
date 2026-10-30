/**
 * Módulo: privy-token-cache
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: A chave gira quando a assinatura falha e o e-mail não fica para sempre.
 * Sequência: N validações buscam a chave uma vez; a assinatura ruim busca de novo; e-mail nulo não entra no cache.
 */
import { createPrivyTokenCache } from './privy-token-cache';

const signatureError = () =>
  Object.assign(new Error('signature verification failed'), {
    code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  });

function clientWith(fetchVerificationKey: () => Promise<string>) {
  return {
    fetchVerificationKey: vi.fn(fetchVerificationKey),
    verifyAuthToken: vi.fn(async (token: string, key?: string) => {
      void key;
      return { userId: `user-${token}` };
    }),
    getUser: vi.fn(),
  };
}

describe('privy-token-cache', () => {
  it('busca a chave uma vez e valida cada token com ela', async () => {
    const client = clientWith(async () => 'spki-key');
    const cache = createPrivyTokenCache(client, {
      fetchVerificationKey: client.fetchVerificationKey,
    });
    const results = await Promise.all([
      cache.verify('a'),
      cache.verify('b'),
      cache.verify('c'),
    ]);
    expect(results).toEqual([
      { privyUserId: 'user-a' },
      { privyUserId: 'user-b' },
      { privyUserId: 'user-c' },
    ]);
    expect(client.fetchVerificationKey).toHaveBeenCalledTimes(1);
    const keys = client.verifyAuthToken.mock.calls.map((call) => call[1]);
    expect(keys).toEqual(['spki-key', 'spki-key', 'spki-key']);
    expect(client.getUser).not.toHaveBeenCalled();
  });

  it('busca a chave de novo uma vez quando a assinatura falha e para no prazo', async () => {
    const fetchVerificationKey = vi
      .fn()
      .mockResolvedValueOnce('old-key')
      .mockResolvedValueOnce('new-key');
    const client = {
      verifyAuthToken: vi.fn(async (token: string, key?: string) => {
        if (token === 'forged' || key === 'old-key') throw signatureError();
        return { userId: 'user-a' };
      }),
      getUser: vi.fn(),
    };
    let clock = 0;
    const cache = createPrivyTokenCache(client, {
      fetchVerificationKey,
      now: () => clock,
    });
    await expect(cache.verify('a')).resolves.toEqual({ privyUserId: 'user-a' });
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
    expect(client.verifyAuthToken).toHaveBeenLastCalledWith('a', 'new-key');
    await expect(cache.verify('forged')).rejects.toThrow(/signature/i);
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
    clock = 45_000;
    fetchVerificationKey.mockResolvedValueOnce('newer-key');
    await expect(cache.verify('a')).resolves.toEqual({ privyUserId: 'user-a' });
    expect(fetchVerificationKey).toHaveBeenCalledTimes(3);
  });

  it('cem tokens forjados no mesmo prazo geram duas buscas, não uma por token', async () => {
    const fetchVerificationKey = vi.fn(async () => 'spki-key');
    const client = {
      verifyAuthToken: vi.fn(async () => {
        throw signatureError();
      }),
      getUser: vi.fn(),
    };
    const cache = createPrivyTokenCache(client, { fetchVerificationKey });
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        cache.verify(`forged-${index}`).catch(() => undefined),
      ),
    );
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
  });

  it('busca a chave de novo quando o prazo acaba', async () => {
    let clock = 0;
    const fetchVerificationKey = vi.fn(async () => 'spki-key');
    const client = {
      verifyAuthToken: vi.fn(async () => ({ userId: 'user-a' })),
      getUser: vi.fn(),
    };
    const cache = createPrivyTokenCache(client, {
      fetchVerificationKey,
      now: () => clock,
    });
    await cache.verify('a');
    clock = 45_000;
    await cache.verify('b');
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
  });

  it('busca a chave de novo se a primeira busca falhar', async () => {
    const fetchVerificationKey = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce('spki-key');
    const client = {
      verifyAuthToken: vi.fn(async () => ({ userId: 'user-a' })),
      getUser: vi.fn(),
    };
    const cache = createPrivyTokenCache(client, { fetchVerificationKey });
    await expect(cache.verify('a')).rejects.toThrow('down');
    await expect(cache.verify('a')).resolves.toEqual({ privyUserId: 'user-a' });
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
    expect(client.verifyAuthToken).toHaveBeenCalledWith('a', 'spki-key');
  });

  it('se o refetch falhar, mantém a chave anterior', async () => {
    let clock = 0;
    const fetchVerificationKey = vi
      .fn()
      .mockResolvedValueOnce('spki-key')
      .mockRejectedValueOnce(new Error('down'));
    const client = {
      verifyAuthToken: vi.fn(async () => ({ userId: 'user-a' })),
      getUser: vi.fn(),
    };
    const cache = createPrivyTokenCache(client, {
      fetchVerificationKey,
      now: () => clock,
    });
    await cache.verify('a');
    clock = 45_000;
    await expect(cache.verify('b')).resolves.toEqual({ privyUserId: 'user-a' });
    expect(client.verifyAuthToken).toHaveBeenLastCalledWith('b', 'spki-key');
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
  });

  it('não guarda e-mail nulo e esquece o mais antigo quando o teto estoura', async () => {
    const client = {
      verifyAuthToken: vi.fn(),
      getUser: vi.fn(async (userId: string) =>
        userId === 'vazio'
          ? { email: { address: '' } }
          : { email: { address: `${userId}@casa.com` } },
      ),
    };
    const cache = createPrivyTokenCache(client, {
      fetchVerificationKey: async () => 'unused',
      emailCap: 2,
      emailTtlMs: 1000,
      now: () => 0,
    });
    await expect(cache.getEmail('vazio')).resolves.toBeNull();
    await expect(cache.getEmail('vazio')).resolves.toBeNull();
    expect(client.getUser).toHaveBeenCalledTimes(2);
    await cache.getEmail('ana');
    await cache.getEmail('bia');
    await cache.getEmail('caio');
    client.getUser.mockClear();
    await cache.getEmail('bia');
    await cache.getEmail('caio');
    expect(client.getUser).not.toHaveBeenCalled();
    await cache.getEmail('ana');
    expect(client.getUser).toHaveBeenCalledWith('ana');
  });
});
