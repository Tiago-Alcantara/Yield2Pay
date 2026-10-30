/**
 * Módulo: expenses.controller
 * Criado em: 2026-10-30
 * Última atualização: 2026-10-30
 * Intuito: Query inválida vira 400 antes de consultar o banco.
 * Sequência: notação científica, hexadecimal, espaço e array são recusados.
 */
import { BadRequestException } from '@nestjs/common';
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
});
