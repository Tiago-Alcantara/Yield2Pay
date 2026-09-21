import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

it('returns ok when the database answers', async () => {
  const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
  const ctrl = new HealthController(prisma as any);
  await expect(ctrl.check()).resolves.toEqual({ status: 'ok' });
  expect(prisma.$queryRaw).toHaveBeenCalled();
});

it('throws 503 when the database does not answer', async () => {
  const prisma = {
    $queryRaw: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
  };
  const ctrl = new HealthController(prisma as any);
  await expect(ctrl.check()).rejects.toBeInstanceOf(
    ServiceUnavailableException,
  );
});
