/**
 * Módulo: backfill-preview
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: O preenchimento preserva o fixo manual e só aceita banco local de teste.
 * Sequência: host na query, socket e banco sem "test" são recusados; o lote grava numa transação.
 */
import {
  applyKeyChanges,
  assertLocalDatabaseUrl,
  previewHouseholdBackfill,
  type KeyWriter,
} from './backfill-preview';

const rent = (
  id: string,
  spentOn: string,
): Parameters<typeof previewHouseholdBackfill>[0][number] => ({
  id,
  merchant: 'Aluguel',
  spentOn,
  amountCents: 250000,
  category: 'housing',
  fixed: false,
  merchantKey: '',
  sharedMerchantKey: '',
});

describe('previewHouseholdBackfill', () => {
  it('preenche a chave e marca o aluguel que se repete', () => {
    const changes = previewHouseholdBackfill([
      rent('a', '2026-09-05'),
      rent('b', '2026-10-05'),
      {
        id: 'c',
        merchant: 'Padaria Estrela',
        spentOn: '2026-10-02',
        amountCents: 1800,
        category: 'groceries',
        fixed: false,
        merchantKey: '',
        sharedMerchantKey: '',
      },
    ]);
    const byId = Object.fromEntries(changes.map((row) => [row.id, row]));
    expect(byId.a).toMatchObject({
      merchantKey: 'aluguel',
      sharedMerchantKey: 'aluguel',
      fixed: true,
    });
    expect(byId.b?.fixed).toBe(true);
    expect(byId.c).toMatchObject({
      merchantKey: 'padaria estrela',
      sharedMerchantKey: 'padaria estrela',
    });
    expect(byId.c?.fixed).toBeUndefined();
  });

  it('não lista uma linha que já está calculada', () => {
    const changes = previewHouseholdBackfill([
      {
        id: 'a',
        merchant: 'Padaria',
        spentOn: '2026-10-02',
        amountCents: 100,
        category: 'groceries',
        fixed: false,
        merchantKey: 'padaria',
        sharedMerchantKey: 'padaria',
      },
    ]);
    expect(changes).toEqual([]);
  });

  it('não desmarca um fixo escolhido à mão', () => {
    const changes = previewHouseholdBackfill([
      {
        id: 'a',
        merchant: 'Padaria',
        spentOn: '2026-10-02',
        amountCents: 100,
        category: 'groceries',
        fixed: true,
        fixedManual: true,
        merchantKey: '',
        sharedMerchantKey: '',
      },
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.fixed).toBeUndefined();
    expect(changes[0]?.merchantKey).toBe('padaria');
  });
});

describe('applyKeyChanges', () => {
  it('grava cada lote na própria transação', async () => {
    const updates: string[][] = [];
    const writer = {
      expense: {
        update: vi.fn(async (args: { where: { id: string } }) => {
          updates.at(-1)?.push(args.where.id);
        }),
      },
      $transaction: vi.fn(async (fn: (tx: typeof writer) => Promise<void>) => {
        updates.push([]);
        await fn(writer);
      }),
    };
    const changes = [
      { id: 'a', merchantKey: 'aluguel' },
      { id: 'b', fixed: true },
      { id: 'c', sharedMerchantKey: 'netflix' },
    ];
    const result = await applyKeyChanges(writer as KeyWriter, changes, 2);
    expect(result).toEqual({ batches: 2, rows: 3 });
    expect(writer.$transaction).toHaveBeenCalledTimes(2);
    expect(updates).toEqual([['a', 'b'], ['c']]);
  });
});

describe('assertLocalDatabaseUrl', () => {
  const local =
    'postgresql://yield2pay:yield2pay@127.0.0.1:5432/yield2pay_test?schema=public';

  it('aceita loopback com nome de teste', () => {
    expect(() => assertLocalDatabaseUrl(local)).not.toThrow();
    expect(() =>
      assertLocalDatabaseUrl('postgresql://u:p@localhost:5432/yield2pay_test'),
    ).not.toThrow();
    expect(() =>
      assertLocalDatabaseUrl('postgresql://u:p@[::1]:5432/casa_test'),
    ).not.toThrow();
  });

  it('recusa host e hostaddr na query, socket e banco que não é de teste', () => {
    expect(() => assertLocalDatabaseUrl(`${local}&host=evil.example`)).toThrow(
      'host na query',
    );
    expect(() => assertLocalDatabaseUrl(`${local}&hostaddr=127.0.0.1`)).toThrow(
      'host na query',
    );
    expect(() =>
      assertLocalDatabaseUrl(
        'postgresql://u:p@/yield2pay_test?host=/var/run/postgresql',
      ),
    ).toThrow('host na query');
    expect(() =>
      assertLocalDatabaseUrl('postgresql:///yield2pay_test'),
    ).toThrow('socket');
    expect(() =>
      assertLocalDatabaseUrl('/var/run/postgresql yield2pay_test'),
    ).toThrow('socket');
    expect(() =>
      assertLocalDatabaseUrl(
        'postgresql://u:p@db.example.com:5432/yield2pay_test',
      ),
    ).toThrow('não é local');
    expect(() =>
      assertLocalDatabaseUrl('postgresql://u:p@127.0.0.1:5432/yield2pay'),
    ).toThrow('precisa ser de teste');
  });
});
