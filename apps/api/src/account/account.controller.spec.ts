import { AccountController } from './account.controller';

it('GET /account/export delega para companies.exportAccount(companyId)', async () => {
  const companies = {
    exportAccount: vi.fn().mockResolvedValue({
      company: { id: 'co_1', privyUserId: 'did:privy:abc', createdAt: new Date('2026-01-01') },
      bills: [],
      deposits: [],
    }),
  };
  const ctrl = new AccountController(companies as any);
  const r = await ctrl.export({ companyId: 'co_1' } as any);
  expect(companies.exportAccount).toHaveBeenCalledWith('co_1');
  expect(r).toEqual({
    company: { id: 'co_1', privyUserId: 'did:privy:abc', createdAt: new Date('2026-01-01') },
    bills: [],
    deposits: [],
  });
});

it('DELETE /account delega para companies.deleteAccount(companyId)', async () => {
  const companies = {
    deleteAccount: vi.fn().mockResolvedValue(undefined),
  };
  const ctrl = new AccountController(companies as any);
  await ctrl.remove({ companyId: 'co_1' } as any);
  expect(companies.deleteAccount).toHaveBeenCalledWith('co_1');
});
