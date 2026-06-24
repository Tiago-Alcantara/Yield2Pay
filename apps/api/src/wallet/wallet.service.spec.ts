import { WalletService } from './wallet.service';
import { NotFoundException } from '@nestjs/common';

it('registers an address (upsert by company)', async () => {
  const prisma = { wallet: { upsert: jest.fn().mockResolvedValue({ stellarAddress: 'GABC' }) } } as any;
  const svc = new WalletService(prisma);
  const r = await svc.register('co_1', 'GABC');
  expect(r.stellarAddress).toBe('GABC');
  expect(prisma.wallet.upsert).toHaveBeenCalledWith({
    where: { companyId: 'co_1' },
    create: { companyId: 'co_1', stellarAddress: 'GABC' },
    update: { stellarAddress: 'GABC' },
  });
});

it('throws when address missing', async () => {
  const prisma = { wallet: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
  const svc = new WalletService(prisma);
  await expect(svc.getAddress('co_x')).rejects.toBeInstanceOf(NotFoundException);
});
