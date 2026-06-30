/**
 * Integration smoke test: PrismaService connects to a real Postgres.
 *
 * NOT part of the hermetic unit suite (`src/**' + '/*.spec.ts`). It needs a live
 * database, so it is gated behind RUN_DB_TESTS=1 to keep `pnpm test` runnable
 * without any infra.
 *
 * Run locally (Postgres up via `pnpm db:up`):
 *   RUN_DB_TESTS=1 pnpm --filter @yield2pay/api test:e2e
 *
 * In CI, set RUN_DB_TESTS=1 and provide DATABASE_URL via a Postgres service
 * container. Unlike the on-chain integration specs, this needs no testnet
 * credentials — only a reachable Postgres.
 */
import { PrismaService } from '../src/prisma/prisma.service';

const SKIP = process.env.RUN_DB_TESTS !== '1';

(SKIP ? describe.skip : describe)('PrismaService (RUN_DB_TESTS=1)', () => {
  let service: PrismaService;

  beforeAll(async () => {
    service = new PrismaService();
    await service.onModuleInit();
  });

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it('connects to the database', async () => {
    // If $connect succeeds the service is reachable
    await expect(service.$queryRaw`SELECT 1`).resolves.toBeDefined();
  });
});
