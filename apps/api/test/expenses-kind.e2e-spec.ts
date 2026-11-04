import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrivyService } from '../src/auth/privy.service';
import { corsOptionsFor } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';
import { saoPauloToday } from '../src/summary/summary.math';

/**
 * Entradas e gastos pela API, com o AppModule inteiro e o Postgres descartável.
 * O Privy é simulado: o token "dona" vira o usuário `${stamp}-dona`.
 * Só roda com RUN_DB_TESTS=1.
 */
describe.skipIf(process.env.RUN_DB_TESTS !== '1')('expenses kind (e2e)', () => {
  const stamp = `e2e-entradas-${Date.now()}`;
  const today = saoPauloToday(new Date());
  const month = today.slice(0, 7);
  let app: INestApplication;
  let prisma: PrismaService;
  let householdId = '';

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

    const household = await request(server)
      .post('/households')
      .set(as('dona'))
      .send({ name: 'Casa' });
    expect(household.status).toBe(201);
    householdId = household.body.id;

    const salary = await request(server)
      .post('/expenses')
      .set(as('dona'))
      .send({
        merchant: 'Salário',
        amountCents: 500000,
        spentOn: today,
        kind: 'income',
      });
    expect(salary.status).toBe(201);
    const market = await request(server)
      .post('/expenses')
      .set(as('dona'))
      .send({
        merchant: 'Mercado',
        amountCents: 12345,
        spentOn: today,
        category: 'groceries',
      });
    expect(market.status).toBe(201);
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
      await prisma.expense.deleteMany({
        where: { householdId: { in: householdIds } },
      });
      await prisma.statement.deleteMany({
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

  it('GET /expenses?kind=income traz só as entradas, sem categoria', async () => {
    const response = await request(app.getHttpServer())
      .get(`/expenses?month=${month}&kind=income`)
      .set(as('dona'));

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      merchant: 'Salário',
      kind: 'income',
      category: null,
      fixed: false,
      amountCents: 500000,
    });
  });

  it('GET /expenses?kind=expense traz só os gastos; sem kind traz os dois', async () => {
    const server = app.getHttpServer();
    const expenses = await request(server)
      .get(`/expenses?month=${month}&kind=expense`)
      .set(as('dona'));
    expect(expenses.status).toBe(200);
    expect(
      expenses.body.items.map((item: { merchant: string }) => item.merchant),
    ).toEqual(['Mercado']);
    expect(expenses.body.total).toBe(1);

    const all = await request(server)
      .get(`/expenses?month=${month}`)
      .set(as('dona'));
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);
  });

  it('GET /expenses com kind inválido responde 400', async () => {
    const server = app.getHttpServer();
    const invalid = await request(server)
      .get(`/expenses?month=${month}&kind=transfer`)
      .set(as('dona'));
    expect(invalid.status).toBe(400);
    const repeated = await request(server)
      .get(`/expenses?month=${month}&kind=income&kind=expense`)
      .set(as('dona'));
    expect(repeated.status).toBe(400);
  });

  it('GET /expenses?kind=income não mostra a entrada de outro grupo', async () => {
    const server = app.getHttpServer();
    const other = await request(server)
      .post('/households')
      .set(as('outra'))
      .send({ name: 'Outra casa' });
    expect(other.status).toBe(201);

    const response = await request(server)
      .get(`/expenses?month=${month}&kind=income`)
      .set(as('outra'));

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
    const foreign = await request(server)
      .get(`/expenses?month=${month}&kind=income`)
      .set(as('outra'))
      .set('X-Household-Id', householdId);
    expect(foreign.status).toBe(404);
  });

  it('POST e PATCH recusam a combinação errada de tipo e categoria com 400', async () => {
    const server = app.getHttpServer();
    const incomeWithCategory = await request(server)
      .post('/expenses')
      .set(as('dona'))
      .send({
        merchant: 'Pix',
        amountCents: 100,
        spentOn: today,
        kind: 'income',
        category: 'groceries',
      });
    expect(incomeWithCategory.status).toBe(400);

    const list = await request(server)
      .get(`/expenses?month=${month}&kind=income`)
      .set(as('dona'));
    const id = list.body.items[0].id as string;
    const categoryOnIncome = await request(server)
      .patch(`/expenses/${id}`)
      .set(as('dona'))
      .send({ category: 'groceries' });
    expect(categoryOnIncome.status).toBe(400);
    const noCategory = await request(server)
      .patch(`/expenses/${id}`)
      .set(as('dona'))
      .send({ kind: 'expense' });
    expect(noCategory.status).toBe(400);
  });

  it('o extrato passa pela prévia sem gravar e a confirmação grava o tipo escolhido', async () => {
    const server = app.getHttpServer();
    const csv = Buffer.from(
      'data,descricao,valor\n02/01/2026,Freela,"+900,00"\n03/01/2026,Padaria,"-18,90"\n04/01/2026,Reembolso,"20,00"\n',
    );
    const before = await prisma.expense.count({ where: { householdId } });

    const preview = await request(server)
      .post('/statements/preview')
      .set(as('dona'))
      .attach('file', csv, 'extrato.csv');

    expect(preview.status).toBe(201);
    expect(
      preview.body.rows.map((row: { merchant: string; kind: string }) => [
        row.merchant,
        row.kind,
      ]),
    ).toEqual([
      ['Freela', 'income'],
      ['Padaria', 'expense'],
      ['Reembolso', 'expense'],
    ]);
    expect(await prisma.expense.count({ where: { householdId } })).toBe(before);
    expect(await prisma.statement.count({ where: { householdId } })).toBe(0);

    const badKinds = await request(server)
      .post('/statements')
      .set(as('dona'))
      .field('kinds', JSON.stringify(['income']))
      .attach('file', csv, 'extrato.csv');
    expect(badKinds.status).toBe(400);

    const confirmed = await request(server)
      .post('/statements')
      .set(as('dona'))
      .field('kinds', JSON.stringify(['income', 'expense', 'income']))
      .attach('file', csv, 'extrato.csv');
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.imported).toBe(3);

    const incomes = await request(server)
      .get('/expenses?month=2026-01&kind=income')
      .set(as('dona'));
    expect(
      incomes.body.items
        .map((item: { merchant: string }) => item.merchant)
        .sort(),
    ).toEqual(['Freela', 'Reembolso']);
    const stored = await prisma.expense.findMany({
      where: { householdId, statementId: confirmed.body.statementId },
    });
    expect(new Set(stored.map((row) => row.source))).toEqual(
      new Set(['statement']),
    );

    const again = await request(server)
      .post('/statements/preview')
      .set(as('dona'))
      .attach('file', csv, 'extrato.csv');
    expect(again.status).toBe(409);

    const undone = await request(server)
      .delete(`/statements/${confirmed.body.statementId}`)
      .set(as('dona'));
    expect(undone.status).toBe(204);
    expect(await prisma.expense.count({ where: { householdId } })).toBe(before);
  });

  it('o resumo mostra entradas e saldo sem mudar o total de gastos', async () => {
    const response = await request(app.getHttpServer())
      .get(`/household/summary?month=${month}`)
      .set(as('dona'));

    expect(response.status).toBe(200);
    expect(response.body.monthTotalCents).toBe(12345);
    expect(response.body.incomeCents).toBe(500000);
    expect(response.body.balanceCents).toBe(487655);
    expect(response.body.byCategory).toEqual([
      { category: 'groceries', amountCents: 12345 },
    ]);
  });
});
