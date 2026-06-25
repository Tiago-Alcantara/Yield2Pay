import { WalletService } from './wallet.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// A valid Stellar Ed25519 public key for testing (generated via Keypair.random())
const VALID_ADDRESS =
  'GDUKN35CP3SQ67QMZL5SKCUCX6MB47TX4SZBTS5UHKFMGTF35Z3723DY';

it('registers an address (upsert by company)', async () => {
  const prisma = {
    wallet: {
      upsert: vi.fn().mockResolvedValue({ stellarAddress: VALID_ADDRESS }),
    },
  } as any;
  const svc = new WalletService(prisma);
  const r = await svc.register('co_1', VALID_ADDRESS);
  expect(r.stellarAddress).toBe(VALID_ADDRESS);
  expect(prisma.wallet.upsert).toHaveBeenCalledWith({
    where: { companyId: 'co_1' },
    create: { companyId: 'co_1', stellarAddress: VALID_ADDRESS },
    update: { stellarAddress: VALID_ADDRESS },
  });
});

it('throws BadRequestException for invalid stellar address (M3)', async () => {
  const prisma = { wallet: { upsert: vi.fn() } } as any;
  const svc = new WalletService(prisma);
  await expect(
    svc.register('co_1', 'not-a-stellar-key'),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(prisma.wallet.upsert).not.toHaveBeenCalled();
});

it('throws when address missing', async () => {
  const prisma = {
    wallet: { findUnique: vi.fn().mockResolvedValue(null) },
  } as any;
  const svc = new WalletService(prisma);
  await expect(svc.getAddress('co_x')).rejects.toBeInstanceOf(
    NotFoundException,
  );
});
