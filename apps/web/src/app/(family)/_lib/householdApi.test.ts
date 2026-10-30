/**
 * Módulo: householdApi
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: O pedido do painel estoura sozinho e o erro chega na hora, sem uma segunda espera.
 * Sequência: rejects a hung request when the timeout elapses.
 */
import { createHouseholdApi } from './householdApi';

describe('householdApi request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('rejects a hung request when the timeout elapses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return;
        const fail = () => reject(Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }));
        if (signal.aborted) fail();
        else signal.addEventListener('abort', fail, { once: true });
      })),
    );
    const api = createHouseholdApi(async () => 'tok', { timeoutMs: 40 });
    const started = performance.now();
    const error = await api.getAccount().then(
      () => null,
      (caught: unknown) => caught,
    );
    const elapsed = performance.now() - started;
    expect(error).toMatchObject({ timeout: true });
    expect(elapsed).toBeLessThan(40 + 1000);
  });
});
