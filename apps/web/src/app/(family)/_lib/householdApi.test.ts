/**
 * Módulo: householdApi
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: O pedido do painel estoura sozinho e cada mês de gastos sai numa chamada só.
 * Sequência: rejects a hung request when the timeout elapses; loads a month with one /expenses call.
 */
import { createHouseholdApi, MONTH_EXPENSE_LIMIT } from './householdApi';

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

  it('does not treat a cancelled request as a timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))),
    );
    const api = createHouseholdApi(async () => 'tok', { timeoutMs: 1000 });
    const error = await api.getAccount().then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toMatchObject({ name: 'AbortError' });
    expect((error as { timeout?: boolean }).timeout).toBeUndefined();
  });

  it('loads a month with one /expenses call', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({
      items: [{ id: 'e1', date: '2026-10-02', merchant: 'Netflix', category: 'subscriptions', fixed: true, amountCents: 5590, addedBy: { displayName: 'Ana', initials: 'A' } }],
      total: 1,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createHouseholdApi(async () => 'tok', { timeoutMs: 1000 });
    const rows = await api.getExpenses({ month: '2026-10' });
    expect(rows).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/expenses?');
    expect(url).toContain('month=2026-10');
    expect(url).toContain(`limit=${MONTH_EXPENSE_LIMIT}`);
    expect(url).not.toContain('offset=');
  });

  it('fetches the next page when the month has more than 5000 expenses', async () => {
    const first = Array.from({ length: 5000 }, (_, index) => ({
      id: `e${index}`,
      date: '2026-10-02',
      merchant: 'Mercado',
      category: 'groceries',
      fixed: false,
      amountCents: 100,
      addedBy: { displayName: 'Ana', initials: 'A' },
    }));
    const fetchMock = vi.fn(async (url: string) => {
      const cursor = new URL(String(url), 'http://local').searchParams.get('cursor');
      const body = cursor
        ? { items: [{ ...first[0], id: 'tail' }], total: 5001, nextCursor: null }
        : { items: first, total: 5001 };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = createHouseholdApi(async () => 'tok', { timeoutMs: 1000 });
    const rows = await api.getExpenses({ month: '2026-10' });
    expect(rows).toHaveLength(5001);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('cursor=2026-10-02%7Ce4999');
  });
});
