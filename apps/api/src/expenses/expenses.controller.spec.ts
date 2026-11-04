/**
 * Módulo: expenses.controller
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: Query inválida vira 400 antes de consultar o banco.
 * Sequência: notação científica, hexadecimal, espaço e array são recusados.
 */
import { BadRequestException } from '@nestjs/common';
import { ExpenseInvalidError } from './expense.errors';
import { ExpensesController } from './expenses.controller';

describe('ExpensesController page query', () => {
  const controller = new ExpensesController({ list: vi.fn() } as never);
  const req = { companyId: 'co' } as never;

  it.each(['1e20', '0x10', '1e3', ' 50 ', ['50']])(
    'responde 400 para %j',
    async (value) => {
      await expect(
        controller.list(req, '2026-10', undefined, undefined, value as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        controller.list(req, '2026-10', undefined, value as never, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(['9999-99-99|a', '2026-02-31|e1'])(
    'responde 400 para cursor %s',
    async (cursor) => {
      await expect(
        controller.list(
          req,
          '2026-10',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          cursor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  function listWithKind(target: ExpensesController, kind: unknown) {
    return target.list(
      req,
      '2026-10',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      kind as never,
    );
  }

  it.each(['transfer', 'INCOME', ['income', 'expense']])(
    'responde 400 para ?kind=%j antes de consultar',
    async (kind) => {
      const list = vi.fn();
      const target = new ExpensesController({ list } as never);
      await expect(listWithKind(target, kind)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(list).not.toHaveBeenCalled();
    },
  );

  it('passa o ?kind= válido para o serviço', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const target = new ExpensesController({ list } as never);
    await listWithKind(target, 'income');
    expect(list.mock.calls[0]?.[5]).toBe('income');
    await listWithKind(target, undefined);
    expect(list.mock.calls[1]?.[5]).toBeUndefined();
  });

  it('o patch recusado pelo serviço vira 400, não 500', async () => {
    const patch = vi.fn().mockRejectedValue(new ExpenseInvalidError());
    const target = new ExpensesController({ patch } as never);
    await expect(
      target.patch(req, 'e1', { kind: 'income', category: 'groceries' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
