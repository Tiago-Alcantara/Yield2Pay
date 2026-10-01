import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApi, errorMessage } from './client';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });
}

describe('createApi', () => {
  it('envia o token e o valor do depósito', async () => {
    const fetchImpl = mockFetch(200, { xdr: 'X', hash: '0xh' });
    const api = createApi({
      baseUrl: 'https://api.example',
      getToken: async () => 'tok123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(api.buildDeposit('10750000')).resolves.toEqual({ xdr: 'X', hash: '0xh' });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example/deposit/build');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
    expect(JSON.parse(String(init.body))).toEqual({ amount: '10750000' });
  });

  it('lança ApiError quando a API recusa', async () => {
    const api = createApi({
      baseUrl: 'https://api.example',
      getToken: async () => null,
      fetchImpl: mockFetch(401, { message: 'no' }) as unknown as typeof fetch,
    });
    await expect(api.getDashboard()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('errorMessage', () => {
  it('prefere a mensagem do corpo da API', () => {
    expect(errorMessage(new ApiError(400, { message: 'amount must be positive' }))).toBe(
      'amount must be positive',
    );
  });
});
