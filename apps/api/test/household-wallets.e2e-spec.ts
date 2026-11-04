import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrivyService } from '../src/auth/privy.service';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { WalletGateway } from '../src/household-wallet/wallet-gateway';
import { PrismaService } from '../src/prisma/prisma.service';
import { saoPauloToday } from '../src/summary/summary.math';
import {
  captureLogs,
  FakeGateway,
  OTHER_G,
  SECRET_S,
  WALLET_G,
  WALLET_M42,
  xlmPayment,
} from './wallet-fixtures';

/**
 * Carteiras pela API, com o AppModule inteiro, o filtro de erros de produção e o
 * Postgres descartável. Horizon e BCB simulados; o Privy também.
 * Só roda com RUN_DB_TESTS=1.
 */
describe.skipIf(process.env.RUN_DB_TESTS !== '1')('carteiras (e2e)', () => {
  const stamp = `e2e-carteira-${Date.now()}`;
  const month = saoPauloToday(new Date()).slice(0, 7);
  let app: INestApplication;
  let prisma: PrismaService;
  let householdId = '';
  let logs: ReturnType<typeof captureLogs>;
  const gateway = new FakeGateway();

  const fakePrivy = {
    verify: async (token: string) => ({
      privyUserId: `${stamp}-${token}`,
      email: `${token}.${stamp}@example.test`,
    }),
    emailFromIdentity: async () => null,
    getEmail: async () => null,
  };

  const as = (token: string) => ({
    Authorization: `Bearer ${token}`,
    'X-Household-Id': householdId,
  });

  const api = () => request(app.getHttpServer());
  const addWallet = (token: string, body: Record<string, unknown>) =>
    api().post('/household-wallets').set(as(token)).send(body);

  /** Nenhuma resposta nem linha de log pode ter o endereço. */
  function expectHidden(body: unknown) {
    const text = JSON.stringify(body);
    for (const secret of [WALLET_G, WALLET_M42, SECRET_S]) {
      expect(text).not.toContain(secret);
    }
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrivyService)
      .useValue(fakePrivy)
      .overrideProvider(WalletGateway)
      .useValue(gateway)
      .compile();
    app = mod.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter('production'));
    await app.init();
    prisma = app.get(PrismaService);

    const household = await request(app.getHttpServer())
      .post('/households')
      .set({ Authorization: 'Bearer dona' })
      .send({ name: 'Casa' });
    expect(household.status).toBe(201);
    householdId = household.body.id;

    // O membro entra direto no grupo: o convite tem o próprio e2e.
    for (const token of ['membro', 'fora']) {
      const account = await request(app.getHttpServer())
        .get('/account')
        .set({ Authorization: `Bearer ${token}` });
      expect(account.status).toBe(200);
    }
    const member = await prisma.company.findUniqueOrThrow({
      where: { privyUserId: `${stamp}-membro` },
    });
    await prisma.householdMember.create({
      data: { householdId, companyId: member.id, role: 'member' },
    });
    logs = captureLogs();
  }, 60_000);

  afterAll(async () => {
    logs?.restore();
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
      await prisma.householdWallet.deleteMany({
        where: { householdId: { in: householdIds } },
      });
      await prisma.expense.deleteMany({
        where: { householdId: { in: householdIds } },
      });
      await prisma.householdMember.deleteMany({
        where: {
          OR: [
            { householdId: { in: householdIds } },
            { companyId: { in: companyIds } },
          ],
        },
      });
      await prisma.household.deleteMany({
        where: { id: { in: householdIds } },
      });
      await prisma.personName.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
      await prisma.assetPriceDaily.deleteMany({});
    }
    await app?.close();
  });

  it('recusa a chave secreta sem ecoar, sem guardar e sem logar', async () => {
    const before = logs.count();
    const response = await addWallet('dona', {
      address: SECRET_S,
      label: 'Minha',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Endereço ou apelido inválido.');
    expectHidden(response.body);
    expect(await prisma.householdWallet.count({ where: { householdId } })).toBe(
      0,
    );
    expect(logs.count()).toBeGreaterThan(before);
    expect(logs.text()).not.toContain(SECRET_S);
  });

  it('recusa a chave secreta no apelido', async () => {
    const response = await addWallet('dona', {
      address: WALLET_G,
      label: SECRET_S,
    });
    expect(response.status).toBe(400);
    expectHidden(response.body);
    expect(logs.text()).not.toContain(SECRET_S);
  });

  it.each([
    [
      'checksum errado',
      `${WALLET_G.slice(0, -1)}${WALLET_G.endsWith('A') ? 'B' : 'A'}`,
    ],
    ['texto', 'abc'],
  ])('recusa G inválido: %s', async (_name, address) => {
    const response = await addWallet('dona', { address, label: 'X' });
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).not.toContain(address);
    expect(logs.text()).not.toContain(address);
  });

  it.each([
    ['chave sem aspas', `{"address":${SECRET_S},"label":"X"}`],
    ['string sem fechar', `{"address":"${SECRET_S}`],
    ['chave depois de vírgula', `{"label":"X",${SECRET_S}}`],
  ])(
    'JSON malformado responde 400 sem a chave na resposta nem no log: %s',
    async (_name, body) => {
      const fragment = SECRET_S.slice(0, 10);
      const before = logs.count();
      const response = await api()
        .post('/household-wallets')
        .set(as('dona'))
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('JSON inválido');
      expect(JSON.stringify(response.body)).not.toContain(fragment);
      expect(logs.count()).toBeGreaterThan(before);
      expect(logs.text()).not.toContain(fragment);
    },
  );

  it('recusa rede desconhecida', async () => {
    const response = await addWallet('dona', {
      address: WALLET_G,
      label: 'X',
      network: 'mainnet',
    });
    expect(response.status).toBe(400);
  });

  it('conta inexistente não cria a carteira', async () => {
    const missing = OTHER_G;
    gateway.existing.delete(missing);
    const response = await addWallet('dona', {
      address: missing,
      label: 'X',
      network: 'testnet',
    });
    gateway.existing.add(missing);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('conta não encontrada nesta rede');
    expect(JSON.stringify(response.body)).not.toContain(missing);
    expect(await prisma.householdWallet.count({ where: { householdId } })).toBe(
      0,
    );
  });

  describe('com carteira', () => {
    let walletId = '';

    beforeAll(async () => {
      gateway.setOperations(WALLET_G, [
        xlmPayment(OTHER_G, WALLET_G, '100.0000000'),
        xlmPayment(WALLET_G, OTHER_G, '10.0000000'),
      ]);
      const response = await addWallet('dona', {
        address: WALLET_G,
        label: 'Nubank',
      });
      expect(response.status).toBe(201);
      walletId = response.body.id;
    });

    it('responde só o endereço mascarado', async () => {
      const list = await api().get('/household-wallets').set(as('dona'));
      expect(list.status).toBe(200);
      expect(list.body).toEqual([
        expect.objectContaining({
          id: walletId,
          label: 'Nubank',
          network: 'public',
          maskedAddress: `G...${WALLET_G.slice(-4)}`,
          syncStatus: 'pending',
          canManage: true,
        }),
      ]);
      expectHidden(list.body);
    });

    it('recusa a mesma carteira de novo e aceita a subconta M', async () => {
      const again = await addWallet('dona', {
        address: WALLET_G,
        label: 'De novo',
      });
      expect(again.status).toBe(409);
      expectHidden(again.body);

      const sub = await addWallet('dona', {
        address: WALLET_M42,
        label: 'Sub',
      });
      expect(sub.status).toBe(201);
      expect(sub.body.maskedAddress).toBe(`M...${WALLET_M42.slice(-4)}`);
      expectHidden(sub.body);
      const remove = await api()
        .delete(`/household-wallets/${sub.body.id}`)
        .set(as('dona'));
      expect(remove.status).toBe(204);
    });

    it('sincroniza e mostra os movimentos para o grupo inteiro', async () => {
      const sync = await api()
        .post('/household-wallets/sync')
        .set(as('membro'));
      expect(sync.status).toBe(200);
      expect(sync.body.changed).toBe(true);
      expect(sync.body.wallets[0]).toMatchObject({
        id: walletId,
        syncStatus: 'ok',
      });
      expectHidden(sync.body);

      const movements = await api()
        .get(`/household-wallets/movements?month=${month}`)
        .set(as('membro'));
      expect(movements.status).toBe(200);
      expect(movements.body.items).toHaveLength(2);
      expect(movements.body.items[0]).toMatchObject({
        origin: 'Carteira Nubank',
        asset: 'XLM',
        canMarkTransfer: false,
      });
      expectHidden(movements.body);

      const expenses = await api()
        .get(`/expenses?month=${month}`)
        .set(as('membro'));
      expect(expenses.body.items).toHaveLength(2);
      expect(expenses.body.items[0].source).toBe('wallet');
      expectHidden(expenses.body);
    });

    it('membro vê mas não altera, não remove e não marca a carteira de outra pessoa', async () => {
      const list = await api().get('/household-wallets').set(as('membro'));
      expect(list.body[0].canManage).toBe(false);

      const rename = await api()
        .patch(`/household-wallets/${walletId}`)
        .set(as('membro'))
        .send({ label: 'Minha' });
      expect(rename.status).toBe(403);

      const remove = await api()
        .delete(`/household-wallets/${walletId}`)
        .set(as('membro'));
      expect(remove.status).toBe(403);

      const movement = await prisma.walletMovement.findFirstOrThrow({
        where: { walletId },
      });
      const mark = await api()
        .patch(`/household-wallets/movements/${movement.id}`)
        .set(as('membro'))
        .send({ ownTransfer: true });
      expect(mark.status).toBe(403);
      expect(
        await prisma.expense.count({
          where: { householdId, excludedFromTotals: true },
        }),
      ).toBe(0);
    });

    it('quem está fora do grupo recebe 404', async () => {
      const outsider = await api().get('/household-wallets').set(as('fora'));
      expect(outsider.status).toBe(404);
      const remove = await api()
        .delete(`/household-wallets/${walletId}`)
        .set(as('fora'));
      expect(remove.status).toBe(404);
    });

    it('a linha da carteira troca de categoria, mas não de tipo, e não é apagada sozinha', async () => {
      const spent = await prisma.expense.findFirstOrThrow({
        where: { householdId, source: 'wallet', kind: 'expense' },
      });
      const category = await api()
        .patch(`/expenses/${spent.id}`)
        .set(as('membro'))
        .send({ category: 'transport' });
      expect(category.status).toBe(200);
      expect(category.body.category).toBe('transport');

      const unknown = await api()
        .patch(`/expenses/${spent.id}`)
        .set(as('dona'))
        .send({ category: 'carteira' });
      expect(unknown.status).toBe(400);

      const kind = await api()
        .patch(`/expenses/${spent.id}`)
        .set(as('dona'))
        .send({ kind: 'income', category: null });
      expect(kind.status).toBe(400);

      const remove = await api()
        .delete(`/expenses/${spent.id}`)
        .set(as('dona'));
      expect(remove.status).toBe(400);
    });

    it('transferência minha muda o resumo; desmarcar devolve', async () => {
      const movement = await prisma.walletMovement.findFirstOrThrow({
        where: { walletId, movementClass: 'expense' },
      });
      const before = await api()
        .get(`/household/summary?month=${month}`)
        .set(as('dona'));
      expect(before.body.monthTotalCents).toBe(2500);

      const mark = await api()
        .patch(`/household-wallets/movements/${movement.id}`)
        .set(as('dona'))
        .send({ ownTransfer: true });
      expect(mark.status).toBe(204);
      const marked = await api()
        .get(`/household/summary?month=${month}`)
        .set(as('dona'));
      expect(marked.body.monthTotalCents).toBe(0);

      const invalid = await api()
        .patch(`/household-wallets/movements/${movement.id}`)
        .set(as('dona'))
        .send({ ownTransfer: 'sim' });
      expect(invalid.status).toBe(400);

      await api()
        .patch(`/household-wallets/movements/${movement.id}`)
        .set(as('dona'))
        .send({ ownTransfer: false });
      const back = await api()
        .get(`/household/summary?month=${month}`)
        .set(as('dona'));
      expect(back.body.monthTotalCents).toBe(2500);
    });

    it('renomear troca a origem no painel e na linha', async () => {
      const rename = await api()
        .patch(`/household-wallets/${walletId}`)
        .set(as('dona'))
        .send({ label: 'Reserva' });
      expect(rename.status).toBe(200);
      expectHidden(rename.body);
      const movements = await api()
        .get(`/household-wallets/movements?month=${month}`)
        .set(as('dona'));
      expect(movements.body.items[0].origin).toBe('Carteira Reserva');
      const line = await prisma.expense.findFirstOrThrow({
        where: { householdId, source: 'wallet' },
      });
      expect(line.merchant).toBe('Carteira Reserva');
    });

    it('sair do grupo leva as carteiras que a pessoa adicionou', async () => {
      const added = await addWallet('membro', {
        address: OTHER_G,
        label: 'Do membro',
      });
      expect(added.status).toBe(201);
      const leave = await api()
        .post('/households/current/leave')
        .set(as('membro'));
      expect(leave.status).toBeLessThan(300);
      expect(
        await prisma.householdWallet.count({ where: { id: added.body.id } }),
      ).toBe(0);
      expect(
        await prisma.householdWallet.count({ where: { id: walletId } }),
      ).toBe(1);
    });

    it('quem adicionou remove; movimentos e linhas saem do painel', async () => {
      const remove = await api()
        .delete(`/household-wallets/${walletId}`)
        .set(as('dona'));
      expect(remove.status).toBe(204);

      const list = await api().get('/household-wallets').set(as('dona'));
      expect(list.body).toEqual([]);
      const movements = await api()
        .get(`/household-wallets/movements?month=${month}`)
        .set(as('dona'));
      expect(movements.body.items).toEqual([]);
      const expenses = await api()
        .get(`/expenses?month=${month}`)
        .set(as('dona'));
      expect(expenses.body.items).toEqual([]);
      const summary = await api()
        .get(`/household/summary?month=${month}`)
        .set(as('dona'));
      expect(summary.body.incomeCents).toBe(0);
      expect(summary.body.monthTotalCents).toBe(0);
    });
  });

  it('apagar meus dados leva as carteiras', async () => {
    const added = await addWallet('dona', {
      address: WALLET_G,
      label: 'Nubank',
    });
    expect(added.status).toBe(201);
    const clear = await api()
      .post('/account/data')
      .set(as('dona'))
      .send({ mode: 'expenses' });
    expect(clear.status).toBeLessThan(300);
    expect(await prisma.householdWallet.count({ where: { householdId } })).toBe(
      0,
    );
  });

  it('nenhum endereço apareceu nos logs de todo o e2e', () => {
    const text = logs.text();
    expect(text).not.toContain(WALLET_G);
    expect(text).not.toContain(WALLET_M42);
    expect(text).not.toContain(SECRET_S);
  });
});
