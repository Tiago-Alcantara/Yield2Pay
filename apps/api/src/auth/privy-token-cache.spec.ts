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

describe('privy-token-cache', () => {
  it('busca a chave uma vez e valida cada token com ela', async () => {
    const client = {
      getVerificationKey: vi.fn(async () => 'spki-key'),
      verifyAuthToken: vi.fn(async (token: string, key?: string) => {
        void key;
        return { userId: `user-${token}` };
      }),
      getUser: vi.fn(),
    };
    const cache = createPrivyTokenCache(client);
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
    expect(client.getVerificationKey).toHaveBeenCalledTimes(1);
    const keys = client.verifyAuthToken.mock.calls.map((call) => call[1]);
    expect(keys).toEqual(['spki-key', 'spki-key', 'spki-key']);
    expect(client.getUser).not.toHaveBeenCalled();
  });

  it('busca a chave de novo quando a assinatura falha', async () => {
    const client = {
      getVerificationKey: vi
        .fn()
        .mockResolvedValueOnce('old-key')
        .mockResolvedValueOnce('new-key'),
      verifyAuthToken: vi.fn(async (_token: string, key?: string) => {
        if (key === 'old-key') throw signatureError();
        return { userId: 'user-a' };
      }),
      getUser: vi.fn(),
    };
    const cache = createPrivyTokenCache(client);
    await expect(cache.verify('a')).resolves.toEqual({ privyUserId: 'user-a' });
    expect(client.getVerificationKey).toHaveBeenCalledTimes(2);
    expect(client.verifyAuthToken).toHaveBeenLastCalledWith('a', 'new-key');
    await cache.verify('b');
    expect(client.getVerificationKey).toHaveBeenCalledTimes(2);
    expect(client.verifyAuthToken).toHaveBeenLastCalledWith('b', 'new-key');
  });

  it('busca a chave de novo quando o prazo acaba', async () => {
    let clock = 0;
    const client = {
      getVerificationKey: vi.fn(async () => 'spki-key'),
      verifyAuthToken: vi.fn(async () => ({ userId: 'user-a' })),
      getUser: vi.fn(),
    };
    const cache = createPrivyTokenCache(client, {
      keyTtlMs: 1000,
      now: () => clock,
    });
    await cache.verify('a');
    clock = 1001;
    await cache.verify('b');
    expect(client.getVerificationKey).toHaveBeenCalledTimes(2);
  });

  it('busca a chave de novo se a primeira busca falhar', async () => {
    const client = {
      getVerificationKey: vi
        .fn()
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValueOnce('spki-key'),
      verifyAuthToken: vi.fn(async () => ({ userId: 'user-a' })),
      getUser: vi.fn(),
    };
    const cache = createPrivyTokenCache(client);
    await expect(cache.verify('a')).rejects.toThrow('down');
    await expect(cache.verify('a')).resolves.toEqual({ privyUserId: 'user-a' });
    expect(client.getVerificationKey).toHaveBeenCalledTimes(2);
    expect(client.verifyAuthToken).toHaveBeenCalledWith('a', 'spki-key');
  });

  it('não guarda e-mail nulo e esquece o mais antigo quando o teto estoura', async () => {
    const client = {
      getVerificationKey: vi.fn(),
      verifyAuthToken: vi.fn(),
      getUser: vi.fn(async (userId: string) =>
        userId === 'vazio'
          ? { email: { address: '' } }
          : { email: { address: `${userId}@casa.com` } },
      ),
    };
    const cache = createPrivyTokenCache(client, {
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
