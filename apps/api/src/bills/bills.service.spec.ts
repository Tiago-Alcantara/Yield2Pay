/**
 * Módulo: bills.service
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: Contas da empresa são criadas, listadas e apagadas para a company certa.
 * Sequência: creates a bill with type defaulting handled by caller; lists only the company bills; remove is scoped to the company.
 */
import { BillsService } from './bills.service';

describe('BillsService', () => {
  it('creates a bill with type defaulting handled by caller', async () => {
    const prisma = {
      recurringBill: { create: vi.fn().mockResolvedValue({ id: 'b1' }) },
    } as any;
    const svc = new BillsService(prisma);
    const r = await svc.create('co_1', {
      vendor: 'OpenAI',
      monthlyCost: '200000',
      type: 'software',
    });
    expect(prisma.recurringBill.create).toHaveBeenCalledWith({
      data: {
        companyId: 'co_1',
        vendor: 'OpenAI',
        monthlyCost: 200000n,
        type: 'software',
      },
    });
    expect(r.id).toBe('b1');
  });

  it('lists only the company bills', async () => {
    const prisma = {
      recurringBill: { findMany: vi.fn().mockResolvedValue([{ id: 'b1' }]) },
    } as any;
    const svc = new BillsService(prisma);
    const r = await svc.list('co_1');
    expect(prisma.recurringBill.findMany).toHaveBeenCalledWith({
      where: { companyId: 'co_1' },
    });
    expect(r).toHaveLength(1);
  });

  it('remove is scoped to the company', async () => {
    const prisma = {
      recurringBill: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as any;
    const svc = new BillsService(prisma);
    await svc.remove('co_1', 'b1');
    expect(prisma.recurringBill.deleteMany).toHaveBeenCalledWith({
      where: { id: 'b1', companyId: 'co_1' },
    });
  });
});
