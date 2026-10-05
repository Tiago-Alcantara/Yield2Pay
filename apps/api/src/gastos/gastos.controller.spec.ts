import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConfirmNotaBody, CreateContaBody, GastosController, JaGasteiBody } from './gastos.controller';

const KEY = '35261000000000000191650010000000011000000013';

async function errorsOf<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  return validate(plainToInstance(cls, plain));
}

it('accepts a name and integer centavos', async () => {
  expect(await errorsOf(CreateContaBody, { name: 'Luz', amountCents: 15000 })).toHaveLength(0);
});

it('rejects an empty name, a string amount, and zero', async () => {
  expect((await errorsOf(CreateContaBody, { name: '', amountCents: 15000 })).length).toBeGreaterThan(0);
  expect((await errorsOf(CreateContaBody, { name: 'Luz', amountCents: '15000' })).length).toBeGreaterThan(0);
  expect((await errorsOf(CreateContaBody, { name: 'Luz', amountCents: 0 })).length).toBeGreaterThan(0);
});

it('accepts only the four fixed categories', async () => {
  expect(await errorsOf(JaGasteiBody, { category: 'conta_da_casa' })).toHaveLength(0);
  expect((await errorsOf(JaGasteiBody, { category: 'escola' })).length).toBeGreaterThan(0);
});

it('accepts a confirmed receipt with or without a 44-digit key', async () => {
  const base = { merchant: 'Padaria', amountCents: 1990, spentOn: '2026-10-04', category: 'mercado' };
  expect(await errorsOf(ConfirmNotaBody, base)).toHaveLength(0);
  expect(await errorsOf(ConfirmNotaBody, { ...base, accessKey: KEY })).toHaveLength(0);
  expect(await errorsOf(ConfirmNotaBody, { ...base, accessKey: '' })).toHaveLength(0);
  expect((await errorsOf(ConfirmNotaBody, { ...base, accessKey: '123' })).length).toBeGreaterThan(0);
  expect((await errorsOf(ConfirmNotaBody, { ...base, category: 'lazer' })).length).toBeGreaterThan(0);
});

it('POST /gastos/contas passes req.companyId', async () => {
  const gastos = { createConta: vi.fn().mockResolvedValue({ id: 'acc_1' }) };
  const ctrl = new GastosController(gastos as any);
  await ctrl.createConta({ companyId: 'co_1' } as any, { name: 'Luz', amountCents: 15000 });
  expect(gastos.createConta).toHaveBeenCalledWith('co_1', { name: 'Luz', amountCents: 15000 });
});

it('GET /gastos/contas passes req.companyId', async () => {
  const gastos = { listContas: vi.fn().mockResolvedValue([]) };
  const ctrl = new GastosController(gastos as any);
  await ctrl.listContas({ companyId: 'co_1' } as any);
  expect(gastos.listContas).toHaveBeenCalledWith('co_1');
});

it('POST /gastos/contas/:id/ja-gastei passes companyId and the id', async () => {
  const gastos = { jaGastei: vi.fn().mockResolvedValue({ id: 'exp_1' }) };
  const ctrl = new GastosController(gastos as any);
  await ctrl.jaGastei({ companyId: 'co_1' } as any, 'acc_1', { category: 'transporte' });
  expect(gastos.jaGastei).toHaveBeenCalledWith('co_1', 'acc_1', { category: 'transporte' });
});

it('POST /gastos/notas passes req.companyId', async () => {
  const gastos = { confirmNota: vi.fn().mockResolvedValue({ id: 'exp_2' }) };
  const ctrl = new GastosController(gastos as any);
  const dto = { merchant: 'Padaria', amountCents: 1990, spentOn: '2026-10-04', category: 'mercado' as const };
  await ctrl.confirmNota({ companyId: 'co_1' } as any, dto);
  expect(gastos.confirmNota).toHaveBeenCalledWith('co_1', dto);
});

it('GET /gastos passes req.companyId', async () => {
  const gastos = { listMonth: vi.fn().mockResolvedValue({ month: '2026-10', expenses: [] }) };
  const ctrl = new GastosController(gastos as any);
  await ctrl.listMonth({ companyId: 'co_1' } as any);
  expect(gastos.listMonth).toHaveBeenCalledWith('co_1');
});
