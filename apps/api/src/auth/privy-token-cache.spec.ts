/**
 * Módulo: privy-token-cache
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-31
 * Intuito: A chave gira quando a assinatura falha e o e-mail não fica para sempre.
 * Sequência: N validações buscam a chave uma vez; a assinatura ruim busca de novo; o refetch já gravado não gera uma terceira busca; token forjado na chave nova é recusado; e-mail nulo não entra no cache.
 */
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { createPrivyTokenCache } from './privy-token-cache';

function spki(key: KeyObject): string {
  return key.export({ type: 'spki', format: 'pem' }).toString();
}

function es256(): string {
  return spki(
    generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey,
  );
}

const KEY_A = es256();
const KEY_B = es256();
const KEY_C = es256();
const RSA_KEY = spki(
  generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey,
);

const signatureError = () =>
  Object.assign(new Error('signature verification failed'), {
    code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  });

const forgedError = () => new Error('token forjado');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * Deixa a chave velha falhar só depois que o refetch do prazo já gravou a nova.
 * A terceira busca, se o código pedir, resolve na hora para a suíte não pendurar.
 */
async function verifyAfterStoredRefresh(input: {
  token: string;
  onNewKey: (key: string) => Promise<{ userId: string }>;
}) {
  const second = deferred<string>();
  let stored!: Promise<string>;
  const fetchVerificationKey = vi
    .fn()
    .mockResolvedValueOnce(KEY_A)
    .mockImplementationOnce(
      () =>
        ({
          then(onFulfilled: (key: string) => Promise<string>) {
            stored = second.promise.then(onFulfilled);
            return stored;
          },
        }) as Promise<string>,
    )
    .mockResolvedValue(KEY_C);
  const stale = deferred<void>();
  let releaseStale: (() => void) | undefined;
  const verifyAuthToken = vi.fn((token: string, key?: string) => {
    if (token === 'quente') return Promise.resolve({ userId: 'user-quente' });
    if (key === KEY_A) {
      stale.resolve();
      return new Promise<{ userId: string }>((_resolve, reject) => {
        releaseStale = () => reject(signatureError());
      });
    }
    return input.onNewKey(key ?? '');
  });
  let clock = 0;
  const cache = createPrivyTokenCache(
    { verifyAuthToken, getUser: vi.fn() },
    { fetchVerificationKey, now: () => clock },
  );
  await cache.verify('quente');
  clock = 45_000;
  const pending = cache.verify(input.token);
  await stale.promise;
  second.resolve(KEY_B);
  await stored;
  await Promise.resolve();
  if (!releaseStale) throw new Error('a chave velha não foi usada');
  releaseStale();
  return { pending, fetchVerificationKey, verifyAuthToken };
}

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
    const client = clientWith(async () => KEY_A);
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
    expect(keys).toEqual([KEY_A, KEY_A, KEY_A]);
    expect(client.getUser).not.toHaveBeenCalled();
  });

  it('busca a chave de novo uma vez quando a assinatura falha e para no prazo', async () => {
    const fetchVerificationKey = vi
      .fn()
      .mockResolvedValueOnce(KEY_A)
      .mockResolvedValueOnce(KEY_B);
    const client = {
      verifyAuthToken: vi.fn(async (token: string, key?: string) => {
        if (token === 'forged' || key === KEY_A) throw signatureError();
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
    expect(client.verifyAuthToken).toHaveBeenLastCalledWith('a', KEY_B);
    await expect(cache.verify('forged')).rejects.toThrow(/signature/i);
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
    clock = 45_000;
    fetchVerificationKey.mockResolvedValueOnce(KEY_C);
    await expect(cache.verify('a')).resolves.toEqual({ privyUserId: 'user-a' });
    expect(fetchVerificationKey).toHaveBeenCalledTimes(3);
  });

  it('cem tokens forjados no mesmo prazo geram duas buscas, não uma por token', async () => {
    const fetchVerificationKey = vi.fn(async () => KEY_A);
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
    const fetchVerificationKey = vi.fn(async () => KEY_A);
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
      .mockResolvedValueOnce(KEY_A);
    const client = {
      verifyAuthToken: vi.fn(async () => ({ userId: 'user-a' })),
      getUser: vi.fn(),
    };
    const cache = createPrivyTokenCache(client, { fetchVerificationKey });
    await expect(cache.verify('a')).rejects.toThrow('down');
    await expect(cache.verify('a')).resolves.toEqual({ privyUserId: 'user-a' });
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
    expect(client.verifyAuthToken).toHaveBeenCalledWith('a', KEY_A);
  });

  it('se o refetch falhar, mantém a chave anterior', async () => {
    let clock = 0;
    const fetchVerificationKey = vi
      .fn()
      .mockResolvedValueOnce(KEY_A)
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
    expect(client.verifyAuthToken).toHaveBeenLastCalledWith('b', KEY_A);
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
  });

  it('não espera o refetch pendurado e usa a chave nova quando o Privy volta', async () => {
    let release: (key: string) => void = () => undefined;
    const fetchVerificationKey = vi
      .fn()
      .mockResolvedValueOnce(KEY_A)
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            release = resolve;
          }),
      );
    const client = {
      verifyAuthToken: vi.fn(async (token: string) => ({
        userId: `user-${token}`,
      })),
      getUser: vi.fn(),
    };
    let clock = 0;
    const cache = createPrivyTokenCache(client, {
      fetchVerificationKey,
      now: () => clock,
    });
    await cache.verify('a');
    clock = 45_000;
    const started = Date.now();
    await expect(cache.verify('b')).resolves.toEqual({ privyUserId: 'user-b' });
    expect(Date.now() - started).toBeLessThan(500);
    expect(client.verifyAuthToken).toHaveBeenLastCalledWith('b', KEY_A);
    release(KEY_B);
    await vi.waitFor(async () => {
      await cache.verify('c');
      expect(client.verifyAuthToken).toHaveBeenLastCalledWith('c', KEY_B);
    });
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
  });

  it('descarta chave lixo e RSA e mantém a anterior', async () => {
    let garbage: Promise<string> = Promise.resolve('');
    let rsa: Promise<string> = Promise.resolve('');
    const fetchVerificationKey = vi
      .fn()
      .mockResolvedValueOnce(KEY_A)
      .mockImplementationOnce(() => {
        garbage = Promise.resolve('lixo');
        return garbage;
      })
      .mockImplementationOnce(() => {
        rsa = Promise.resolve(RSA_KEY);
        return rsa;
      });
    const client = {
      verifyAuthToken: vi.fn<
        (token: string, key?: string) => Promise<{ userId: string }>
      >(async () => ({ userId: 'user-a' })),
      getUser: vi.fn(),
    };
    let clock = 0;
    const cache = createPrivyTokenCache(client, {
      fetchVerificationKey,
      now: () => clock,
    });
    await cache.verify('a');
    clock = 45_000;
    await expect(cache.verify('b')).resolves.toEqual({ privyUserId: 'user-a' });
    await garbage;
    await new Promise((resolve) => setTimeout(resolve, 30));
    await expect(cache.verify('c')).resolves.toEqual({ privyUserId: 'user-a' });
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
    clock = 90_000;
    await expect(cache.verify('d')).resolves.toEqual({ privyUserId: 'user-a' });
    await rsa;
    await new Promise((resolve) => setTimeout(resolve, 30));
    await expect(cache.verify('e')).resolves.toEqual({ privyUserId: 'user-a' });
    expect(fetchVerificationKey).toHaveBeenCalledTimes(3);
    expect(
      client.verifyAuthToken.mock.calls.every((call) => call[1] === KEY_A),
    ).toBe(true);
  });

  it('reusa a chave já gravada pelo refetch e não busca uma terceira vez', async () => {
    const { pending, fetchVerificationKey, verifyAuthToken } = await verifyAfterStoredRefresh({
      token: 'girado',
      onNewKey: async () => ({ userId: 'user-girado' }),
    });
    await expect(pending).resolves.toEqual({ privyUserId: 'user-girado' });
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
    expect(verifyAuthToken).toHaveBeenCalledWith('girado', KEY_A);
    expect(verifyAuthToken).toHaveBeenCalledWith('girado', KEY_B);
    expect(verifyAuthToken).not.toHaveBeenCalledWith('girado', KEY_C);
  });

  it('recusa o token forjado na tentativa com a chave nova e propaga o erro', async () => {
    const { pending, fetchVerificationKey, verifyAuthToken } = await verifyAfterStoredRefresh({
      token: 'forjado',
      onNewKey: async () => {
        throw forgedError();
      },
    });
    await expect(pending).rejects.toThrow('token forjado');
    expect(fetchVerificationKey).toHaveBeenCalledTimes(2);
    expect(verifyAuthToken).toHaveBeenCalledWith('forjado', KEY_B);
    expect(verifyAuthToken).not.toHaveBeenCalledWith('forjado', KEY_C);
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
