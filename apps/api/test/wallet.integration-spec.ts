/**
 * Hermetic HTTP integration: /wallet/balance + /deposit/build pré-check.
 *
 * Roda sob a config e2e (vitest.config.e2e.ts). NÃO precisa de Postgres nem de
 * testnet: o AppModule sobe com AuthGuard, PrismaService e StellarService
 * sobrescritos (stubs), então `app.init()` não conecta no banco nem na chain.
 *
 *   pnpm --filter @yield2pay/api test:e2e
 *
 * Cobre:
 *   (a) GET /wallet/balance responde { balance, spendable } (spendable = balance − reserva).
 *   (b) POST /deposit/build rejeita (400) saldo insuficiente — sem chamar fundClient.
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { isFinancialProductEnabled } from '../src/config/financial-product';
import { AuthGuard } from '../src/auth/auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { StellarService } from '../src/stellar/stellar.service';
import { RESERVE_BUFFER_BASE_UNITS } from '../src/common/reserve';

const describeProduct = isFinancialProductEnabled() ? describe : describe.skip;

describeProduct('Wallet balance + deposit pré-check (HTTP hermético)', () => {
  let app: INestApplication;

  const stellar = {
    getNativeBalance: vi.fn(),
    fundClient: vi.fn(),
  };
  const prisma = {
    wallet: { findUnique: vi.fn() },
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().companyId = 'co_1';
          return true;
        },
      })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(StellarService)
      .useValue(stellar)
      .compile();

    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    stellar.getNativeBalance.mockReset();
    stellar.fundClient.mockReset();
    prisma.wallet.findUnique.mockReset();
    prisma.wallet.findUnique.mockResolvedValue({
      companyId: 'co_1',
      stellarAddress: 'GADDR',
    });
  });

  it('GET /wallet/balance retorna balance e spendable', async () => {
    stellar.getNativeBalance.mockResolvedValue(1_200_000_000n); // 120 XLM

    const res = await request(app.getHttpServer())
      .get('/wallet/balance')
      .set('Authorization', 'Bearer test')
      .expect(200);

    expect(res.body).toEqual({
      balance: '1200000000',
      spendable: (1_200_000_000n - RESERVE_BUFFER_BASE_UNITS).toString(),
    });
  });

  it('POST /deposit/build rejeita quando o saldo da carteira é insuficiente (sem fundClient)', async () => {
    // Só 0.1 XLM acima da reserva → spendable = 1_000_000 base units.
    stellar.getNativeBalance.mockResolvedValue(RESERVE_BUFFER_BASE_UNITS + 1_000_000n);

    await request(app.getHttpServer())
      .post('/deposit/build')
      .set('Authorization', 'Bearer test')
      .send({ amount: '1000000000' }) // 100 XLM
      .expect(400);

    expect(stellar.fundClient).not.toHaveBeenCalled();
  });
});
