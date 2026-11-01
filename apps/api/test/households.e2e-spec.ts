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

  /** Aceite antigo: a pessoa entra na família sem ter grupo próprio. */
  async function joinFamily(token: string) {
    const server = app.getHttpServer();
    const invite = await request(server)
      .post('/households/current/invites')
      .set(as('dona'))
      .send({ email: `${token}.${stamp}@example.test` });
    expect(invite.status).toBe(201);
    const accepted = await request(server)
      .post(`/households/invites/${invite.body.id}/accept`)
      .set(as(token));
    expect(accepted.status).toBe(201);
  }

  /** Quantos grupos a pessoa tem, direto no banco. */
  async function memberships(token: string) {
    return prisma.householdMember.count({
      where: { company: { privyUserId: `${stamp}-${token}` } },
    });
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
    const skipped = await request(server)
      .post('/household/profile/skip')
      .set(as('dona'));
    expect(skipped.status).toBe(201);

    await joinFamily('antigo');

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
    expect(memberDefault.body).toMatchObject({
      id: familyHouseholdId,
      role: 'member',
      personal: false,
    });

    const memberFamily = await request(server)
      .get('/households/current')
      .set(as('antigo'))
      .set('X-Household-Id', familyHouseholdId);
    expect(memberFamily.status).toBe(200);
    expect(memberFamily.body.id).toBe(familyHouseholdId);
  });

  it('o primeiro /account do membro antigo cria o individual e devolve a família ativa', async () => {
    const server = app.getHttpServer();
    expect(await memberships('antigo')).toBe(1);

    const response = await request(server).get('/account').set(as('antigo'));
    expect(response.status).toBe(200);
    expect(response.body.households).toHaveLength(2);
    expect(await memberships('antigo')).toBe(2);
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
      id: familyHouseholdId,
      role: 'member',
      personal: false,
    });

    // O individual só cria uma vez, e continua na família.
    const again = await request(server).get('/account').set(as('antigo'));
    expect(again.body.households).toHaveLength(2);
    expect(again.body.activeHousehold.id).toBe(familyHouseholdId);
    expect(await memberships('antigo')).toBe(2);
  });

  it('aceite novo: a família fica ativa, com o onboardingCompleted dela', async () => {
    const server = app.getHttpServer();
    await joinFamily('novo');
    const response = await request(server).get('/account').set(as('novo'));
    expect(response.status).toBe(200);
    expect(response.body.activeHousehold).toEqual({
      id: familyHouseholdId,
      name: 'Família',
      role: 'member',
      personal: false,
      onboardingCompleted: true,
    });
    // O individual recém-criado nasce sem onboarding: não pode ser ele a decidir.
    const personalId = response.body.households.find(
      (item: { personal: boolean }) => item.personal,
    ).id;
    const personal = await request(server)
      .get('/households/current')
      .set(as('novo'))
      .set('X-Household-Id', personalId);
    expect(personal.body.onboardingCompleted).toBe(false);
  });

  it('leave sem header sai da família e mantém o individual', async () => {
    const server = app.getHttpServer();
    await joinFamily('saindo');
    await request(server).get('/account').set(as('saindo'));
    expect(await memberships('saindo')).toBe(2);

    const left = await request(server)
      .post('/households/current/leave')
      .set(as('saindo'));
    expect(left.status).toBe(201);

    const after = await request(server).get('/account').set(as('saindo'));
    expect(after.body.households).toHaveLength(1);
    expect(after.body.activeHousehold).toMatchObject({
      role: 'owner',
      personal: true,
    });
    expect(after.body.activeHousehold.id).not.toBe(familyHouseholdId);
  });

  it('pedido com header nunca cria grupo individual, nem de grupo alheio', async () => {
    const server = app.getHttpServer();
    await joinFamily('curioso');
    const foreignAccount = await request(server)
      .get('/account')
      .set(as('curioso'))
      .set('X-Household-Id', strangerHouseholdId);
    expect(foreignAccount.status).toBe(404);
    const foreignGuard = await request(server)
      .get('/households/current')
      .set(as('curioso'))
      .set('X-Household-Id', strangerHouseholdId);
    expect(foreignGuard.status).toBe(404);
    const ownHeader = await request(server)
      .get('/account')
      .set(as('curioso'))
      .set('X-Household-Id', familyHouseholdId);
    expect(ownHeader.status).toBe(200);
    expect(ownHeader.body.households).toHaveLength(1);
    // Rota com guard e PATCH /account sem header também não criam.
    await request(server).get('/households/current').set(as('curioso'));
    await request(server)
      .patch('/account')
      .set(as('curioso'))
      .send({ displayName: 'Curioso' });
    expect(await memberships('curioso')).toBe(1);
  });

  describe('contrato do /account com o web da develop', () => {
    /**
     * A regra do web publicado (develop 5511db9), que lê account.household:
     * apps/web/src/app/(family)/dashboard/PainelGastos.tsx:372 manda para o
     * onboarding quem não tem household;
     * apps/web/src/app/(family)/dashboard/PainelGastos.tsx:412 abre o modal de
     * onboarding quando o grupo atual não completou.
     */
    async function developPhase(token: string) {
      const server = app.getHttpServer();
      const account = await request(server).get('/account').set(as(token));
      expect(account.status).toBe(200);
      if (!account.body.household) return 'onboarding';
      const current = await request(server)
        .get('/households/current')
        .set(as(token));
      expect(current.status).toBe(200);
      return current.body.onboardingCompleted ? 'panel' : 'panel+onboarding';
    }

    it('household é igual a activeHousehold e tem os campos da develop', async () => {
      for (const token of ['dona', 'antigo']) {
        const { body } = await request(app.getHttpServer())
          .get('/account')
          .set(as(token));
        expect(body.household).toEqual(body.activeHousehold);
        expect(body.household).toEqual(
          expect.objectContaining({
            id: familyHouseholdId,
            name: 'Família',
            role: token === 'dona' ? 'owner' : 'member',
            onboardingCompleted: true,
          }),
        );
      }
    });

    it('dono e membro da família não caem no onboarding', async () => {
      await expect(developPhase('dona')).resolves.toBe('panel');
      await expect(developPhase('antigo')).resolves.toBe('panel');
      await joinFamily('primeira-vez');
      await expect(developPhase('primeira-vez')).resolves.toBe('panel');
    });

    it('quem não tem grupo continua com household nulo e cai no onboarding', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/account')
        .set(as('sem-grupo'));
      expect(body.household).toBeNull();
      expect(body.activeHousehold).toBeNull();
      await expect(developPhase('sem-grupo')).resolves.toBe('onboarding');
    });
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
