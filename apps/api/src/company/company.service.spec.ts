import { CompanyService } from './company.service';

const prisma = {
  company: {
    upsert: vi.fn().mockResolvedValue({ id: 'co_1' }),
  },
} as any;

it('find-or-creates by privyUserId', async () => {
  const svc = new CompanyService(prisma);
  const c = await svc.findOrCreate('did:privy:abc');
  expect(c.id).toBe('co_1');
  expect(prisma.company.upsert).toHaveBeenCalledWith({
    where: { privyUserId: 'did:privy:abc' },
    create: { privyUserId: 'did:privy:abc' },
    update: {},
  });
});
