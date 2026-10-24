import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { isFinancialProductEnabled } from '../src/config/financial-product';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Com a flag desligada o grafo não registra cofre, carteira, depósito, saque,
 * ramp nem ledger. Chamar o endpoint direto responde 404.
 */
describe.skipIf(isFinancialProductEnabled(process.env))('produto financeiro oculto', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();
    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['get', '/wallet'],
    ['get', '/wallet/balance'],
    ['post', '/deposit/build'],
    ['post', '/withdraw/build'],
    ['get', '/ramp/status'],
    ['get', '/dashboard'],
  ])('%s %s responde 404', async (method, path) => {
    const res = await request(app.getHttpServer())[method](path);
    expect(res.status).toBe(404);
  });

  it('GET /health continua no ar', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
  });
});
