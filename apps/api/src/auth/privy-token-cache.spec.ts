/**
 * Módulo: privy-token-cache
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: O token é conferido com a chave em memória, sem buscar a chave de novo.
 * Sequência: N validações paralelas buscam a chave uma vez; N e-mails do mesmo usuário buscam o usuário uma vez.
 */
import { createPrivyTokenCache } from './privy-token-cache';

describe('privy-token-cache', () => {
  it('busca a chave uma vez e valida cada token com ela', async () => {
    const client = {
      getVerificationKey: vi.fn(async () => 'spki-key'),
      verifyAuthToken: vi.fn(async (token: string) => ({ userId: `user-${token}` })),
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
    expect(client.verifyAuthToken).toHaveBeenCalledTimes(3);
    for (const call of client.verifyAuthToken.mock.calls) {
      expect(call[1]).toBe('spki-key');
    }
    expect(client.getUser).not.toHaveBeenCalled();
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

  it('busca o e-mail uma vez por usuário', async () => {
    const client = {
      getVerificationKey: vi.fn(),
      verifyAuthToken: vi.fn(),
      getUser: vi.fn(async () => ({ email: { address: 'Ana@Example.com' } })),
    };
    const cache = createPrivyTokenCache(client);
    const emails = await Promise.all([
      cache.getEmail('did:privy:ana'),
      cache.getEmail('did:privy:ana'),
      cache.getEmail('did:privy:ana'),
    ]);
    expect(emails).toEqual([
      'ana@example.com',
      'ana@example.com',
      'ana@example.com',
    ]);
    expect(client.getUser).toHaveBeenCalledTimes(1);
    expect(client.getVerificationKey).not.toHaveBeenCalled();
  });
});
