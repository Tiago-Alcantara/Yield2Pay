import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrivyService } from '../src/auth/privy.service';
import { corsOptionsFor } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Vários grupos com o AppModule inteiro e o Postgres descartável.
 * O Privy é simulado: o token "dona" vira o usuário `${stamp}-dona`.
 * Só roda com RUN_DB_TESTS=1.
 */
describe.skipIf(process.env.RUN_DB_TESTS !== '1')('households (e2e)', () => {
  const stamp = `e2e-grupos-${Date.now()}`;
  let app: INestApplication;
  let prisma: PrismaService;
  let familyHouseholdId = '';
  let strangerHouseholdId = '';

  const fakePrivy = {
    verify: async (token: string) => ({
      privyUserId: `${stamp}-${token}`,
      email: `${token}.${stamp}@example.test`,
    }),
    emailFromIdentity: async () => null,
    getEmail: async () => null,
  };

  function as(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrivyService)
      .useValue(fakePrivy)
      .compile();
    app = mod.createNestApplication();
    app.enableCors(corsOptionsFor(process.env));
    await app.init();
    prisma = app.get(PrismaService);
    const server = app.getHttpServer();

    const family = await request(server)
      .post('/households')
      .set(as('dona'))
      .send({ name: 'Família' });
    expect(family.status).toBe(201);
    familyHouseholdId = family.body.id;

    // Aceite antigo: o membro entra na família sem ter grupo próprio.
    const invite = await request(server)
      .post('/households/current/invites')
      .set(as('dona'))
      .send({ email: `antigo.${stamp}@example.test` });
    expect(invite.status).toBe(201);
    const accepted = await request(server)
      .post(`/households/invites/${invite.body.id}/accept`)
      .set(as('antigo'));
    expect(accepted.status).toBe(201);

    const stranger = await request(server)
      .post('/households')
      .set(as('estranho'))
      .send({ name: 'Outra casa' });
    expect(stranger.status).toBe(201);
    strangerHouseholdId = stranger.body.id;
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      const companies = await prisma.company.findMany({
        where: { privyUserId: { startsWith: stamp } },
        select: { id: true },
      });
      const companyIds = companies.map((company) => company.id);
      const households = await prisma.household.findMany({
        where: { ownerCompanyId: { in: companyIds } },
        select: { id: true },
      });
      const householdIds = households.map((household) => household.id);
      await prisma.householdInvite.deleteMany({
        where: { householdId: { in: householdIds } },
      });
      await prisma.householdMember.deleteMany({
        where: { householdId: { in: householdIds } },
      });
      await prisma.household.deleteMany({
        where: { id: { in: householdIds } },
      });
      await prisma.personName.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    }
    await app?.close();
  });

  it('responde 404 com o header de um grupo alheio e com id malformado', async () => {
    const server = app.getHttpServer();
    const foreign = await request(server)
      .get('/expenses/months')
      .set(as('antigo'))
      .set('X-Household-Id', strangerHouseholdId);
    expect(foreign.status).toBe(404);
    const malformed = await request(server)
      .get('/household/summary?month=2026-10')
      .set(as('dona'))
      .set('X-Household-Id', 'nao-e-um-id');
    expect(malformed.status).toBe(404);
    const account = await request(server)
      .get('/account')
      .set(as('estranho'))
      .set('X-Household-Id', familyHouseholdId);
    expect(account.status).toBe(404);
  });

  it('sem header usa o grupo padrão; com header de grupo próprio usa o pedido', async () => {
    const server = app.getHttpServer();
    const ownerCurrent = await request(server)
      .get('/households/current')
      .set(as('dona'));
    expect(ownerCurrent.status).toBe(200);
    expect(ownerCurrent.body.id).toBe(familyHouseholdId);

    const summary = await request(server)
      .get('/household/summary?month=2026-10')
      .set(as('dona'));
    expect(summary.status).toBe(200);

    const memberDefault = await request(server)
      .get('/households/current')
      .set(as('antigo'));
    expect(memberDefault.status).toBe(200);
    expect(memberDefault.body.personal).toBe(true);
    expect(memberDefault.body.id).not.toBe(familyHouseholdId);

    const memberFamily = await request(server)
      .get('/households/current')
      .set(as('antigo'))
      .set('X-Household-Id', familyHouseholdId);
    expect(memberFamily.status).toBe(200);
    expect(memberFamily.body).toMatchObject({
      id: familyHouseholdId,
      role: 'member',
      personal: false,
    });
  });

  it('o membro antigo recebe households[] com 2 itens e o individual ativo', async () => {
    const response = await request(app.getHttpServer())
      .get('/account')
      .set(as('antigo'));
    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('household');
    expect(response.body.households).toHaveLength(2);
    const personal = response.body.households.find(
      (item: { personal: boolean }) => item.personal,
    );
    expect(personal).toMatchObject({ role: 'owner', personal: true });
    expect(response.body.households).toContainEqual({
      id: familyHouseholdId,
      name: 'Família',
      role: 'member',
      personal: false,
    });
    expect(response.body.activeHousehold).toMatchObject({
      id: personal.id,
      personal: true,
    });

    const again = await request(app.getHttpServer())
      .get('/account')
      .set(as('antigo'));
    expect(again.body.households).toHaveLength(2);
  });

  it('o preflight OPTIONS libera X-Household-Id', async () => {
    const response = await request(app.getHttpServer())
      .options('/account')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set(
        'Access-Control-Request-Headers',
        'authorization,content-type,privy-id-token,x-household-id',
      );
    expect(response.status).toBe(204);
    const allowed = String(response.headers['access-control-allow-headers'])
      .split(',')
      .map((item) => item.trim().toLowerCase());
    expect(allowed).toEqual(
      expect.arrayContaining([
        'authorization',
        'content-type',
        'privy-id-token',
        'x-household-id',
      ]),
    );
  });
});
