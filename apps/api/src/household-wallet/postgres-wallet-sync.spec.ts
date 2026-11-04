/**
 * Módulo: postgres-wallet-sync
 * Criado em: 2026-11-04
 * Última atualização: 2026-11-04
 * Intuito: O sync grava movimentos e linhas certos no Postgres de verdade, com Horizon e BCB simulados, e nada disso vaza o endereço.
 * Sequência: recebido soma em Entradas e enviado soma em Gastos, com categoria shopping trocável; conversão e info ficam só no movimento, fora dos totais; claimable só conta para quem recebe no resgate; taxa só como fonte, e menos de um centavo fica só no movimento; carteira M grava só a subconta; repetir o sync não duplica; o intervalo mínimo não chama o Horizon de novo; 429 no meio vira updating, respeita o Retry-After e depois não falta nem repete movimento; outro ativo aparece sem valor e fora do total; sem preço fica fora do total e entra quando o preço chega; fim de semana usa a PTAX do último dia útil, a carteira testnet usa o preço da mainnet e o cache não busca de novo; importação inicial para em 90 dias e em 1000 operações, sem falhar depois; transferência minha tira do total e desmarcar devolve; remover a carteira tira movimentos e linhas do painel; o endereço não aparece em nenhum log do sync.
 * Só roda com RUN_DB_TESTS=1 e PG_TEST_URL, com as migrations aplicadas.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  captureLogs,
  FakeGateway,
  horizonOp,
  OTHER_G,
  WALLET_G,
  xlmPayment,
} from '../../test/wallet-fixtures';
import type { ActiveMembership } from '../auth/authenticated-request';
import type { PrismaService } from '../prisma/prisma.service';
import { saoPauloToday } from '../summary/summary.math';
import { SummaryService } from '../summary/summary.service';
import { USDC_CIRCLE_ISSUER } from './classify-operation';
import {
  GatewayRateLimitedError,
  GatewayUnavailableError,
} from './wallet.errors';
import { HouseholdWalletService } from './household-wallet.service';
import type { WalletGateway } from './wallet-gateway';
import { WalletPricesService } from './wallet-prices.service';
import { MIN_SYNC_INTERVAL_MS, WalletSyncService } from './wallet-sync.service';

const DATABASE_URL =
  process.env.RUN_DB_TESTS === '1' ? process.env.PG_TEST_URL : undefined;

describe.skipIf(!DATABASE_URL)('sync da carteira no banco', () => {
  if (!DATABASE_URL) return;
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  });
  const db = client as unknown as PrismaService;
  const stamp = `wsync-${Date.now()}`;
  let counter = 0;
  let membership: ActiveMembership;
  let gateway: FakeGateway;
  let sync: WalletSyncService;
  let service: HouseholdWalletService;
  const summary = new SummaryService(db);
  const today = saoPauloToday(new Date());
  const month = today.slice(0, 7);

  beforeEach(async () => {
    counter += 1;
    const owner = await client.company.create({
      data: { privyUserId: `${stamp}-${counter}` },
    });
    const household = await client.household.create({
      data: {
        name: 'Casa',
        ownerCompanyId: owner.id,
        members: { create: { companyId: owner.id, role: 'owner' } },
      },
    });
    membership = {
      householdId: household.id,
      companyId: owner.id,
      role: 'owner',
      personal: false,
    };
    gateway = new FakeGateway();
    const fake = gateway as unknown as WalletGateway;
    sync = new WalletSyncService(db, fake, new WalletPricesService(db, fake));
    service = new HouseholdWalletService(db, fake, sync);
    await client.assetPriceDaily.deleteMany({});
  });

  afterAll(async () => {
    const companies = await client.company.findMany({
      where: { privyUserId: { startsWith: stamp } },
      select: { id: true },
    });
    const companyIds = companies.map((company) => company.id);
    const households = await client.household.findMany({
      where: { ownerCompanyId: { in: companyIds } },
      select: { id: true },
    });
    const householdIds = households.map((household) => household.id);
    await client.householdWallet.deleteMany({
      where: { householdId: { in: householdIds } },
    });
    await client.expense.deleteMany({
      where: { householdId: { in: householdIds } },
    });
    await client.householdMember.deleteMany({
      where: { householdId: { in: householdIds } },
    });
    await client.household.deleteMany({ where: { id: { in: householdIds } } });
    await client.company.deleteMany({ where: { id: { in: companyIds } } });
    await client.assetPriceDaily.deleteMany({});
    await client.$disconnect();
  });

  async function addWallet(
    fields: { muxedId?: string; network?: string } = {},
  ) {
    return client.householdWallet.create({
      data: {
        householdId: membership.householdId,
        addedByCompanyId: membership.companyId,
        network: fields.network ?? 'public',
        accountId: WALLET_G,
        muxedId: fields.muxedId ?? null,
        label: 'Nubank',
      },
    });
  }

  /** O intervalo mínimo passou. */
  async function releaseInterval(walletId: string) {
    await client.householdWallet.update({
      where: { id: walletId },
      data: { syncNotBefore: new Date(Date.now() - 1000) },
    });
  }

  const movementsOf = (walletId: string) =>
    client.walletMovement.findMany({
      where: { walletId },
      orderBy: { opId: 'asc' },
    });

  const linesOf = () =>
    client.expense.findMany({
      where: { householdId: membership.householdId, source: 'wallet' },
      orderBy: { fitId: 'asc' },
    });

  const totals = async () => {
    const view = await summary.summary(membership, month);
    return { spent: view.monthTotalCents, income: view.incomeCents };
  };

  it('recebido soma em Entradas e enviado soma em Gastos, com categoria shopping trocável', async () => {
    const wallet = await addWallet();
    gateway.setOperations(WALLET_G, [
      xlmPayment(OTHER_G, WALLET_G, '100.0000000'),
      xlmPayment(WALLET_G, OTHER_G, '10.0000000'),
    ]);

    const outcome = await sync.syncWallet(wallet.id);

    expect(outcome).toMatchObject({ syncStatus: 'ok', inserted: 2 });
    const lines = await linesOf();
    expect(
      lines.map((line) => [line.kind, line.category, line.amountCents]),
    ).toEqual([
      ['income', null, 25000],
      ['expense', 'shopping', 2500],
    ]);
    expect(lines[0]?.merchant).toBe('Carteira Nubank');
    expect(await totals()).toEqual({ spent: 2500, income: 25000 });
    const movements = await movementsOf(wallet.id);
    expect(movements.every((row) => row.expenseId != null)).toBe(true);
    const saved = await client.householdWallet.findUnique({
      where: { id: wallet.id },
    });
    expect(saved?.syncStatus).toBe('ok');
    expect(saved?.lastSyncedAt).not.toBeNull();
    expect(saved?.cursor).toBeTruthy();
  });

  it('conversão e info ficam só no movimento, fora dos totais', async () => {
    const wallet = await addWallet();
    const usdc = {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: USDC_CIRCLE_ISSUER.public,
    };
    const trade = horizonOp({ type: 'manage_sell_offer' });
    gateway.effectsByOp.set(trade.id, [
      {
        type: 'trade',
        account: WALLET_G,
        bought_amount: '5.0000000',
        bought_asset_type: 'native',
      },
    ]);
    gateway.setOperations(WALLET_G, [
      horizonOp({
        type: 'path_payment_strict_send',
        from: WALLET_G,
        to: WALLET_G,
        amount: '50.0000000',
        source_amount: '100.0000000',
        source_asset_type: 'native',
        ...usdc,
      }),
      trade,
      horizonOp({ type: 'manage_sell_offer' }),
      horizonOp({ type: 'change_trust' }),
      horizonOp({ type: 'set_options' }),
    ]);

    await sync.syncWallet(wallet.id);

    const movements = await movementsOf(wallet.id);
    expect(movements.map((row) => row.movementClass)).toEqual([
      'conversion',
      'conversion',
      'info',
      'info',
      'info',
    ]);
    expect(movements.every((row) => row.expenseId === null)).toBe(true);
    expect(await linesOf()).toEqual([]);
    expect(await totals()).toEqual({ spent: 0, income: 0 });
  });

  it('claimable só conta para quem recebe no resgate', async () => {
    const wallet = await addWallet();
    gateway.setOperations(WALLET_G, [
      horizonOp({
        type: 'create_claimable_balance',
        source_account: OTHER_G,
        asset: 'native',
        amount: '4.0000000',
      }),
    ]);

    await sync.syncWallet(wallet.id);
    expect(await totals()).toEqual({ spent: 0, income: 0 });

    const claim = horizonOp({
      type: 'claim_claimable_balance',
      claimant: WALLET_G,
    });
    gateway.effectsByOp.set(claim.id, [
      {
        type: 'account_credited',
        account: WALLET_G,
        amount: '4.0000000',
        asset_type: 'native',
      },
    ]);
    await releaseInterval(wallet.id);
    gateway.setOperations(WALLET_G, [
      ...(gateway.operationsByAccount.get(WALLET_G) ?? []),
      claim,
    ]);
    await sync.syncWallet(wallet.id);
    expect(await totals()).toEqual({ spent: 0, income: 1000 });

    await releaseInterval(wallet.id);
    gateway.setOperations(WALLET_G, [
      ...(gateway.operationsByAccount.get(WALLET_G) ?? []),
      horizonOp({
        type: 'create_claimable_balance',
        source_account: WALLET_G,
        asset: 'native',
        amount: '2.0000000',
      }),
    ]);
    await sync.syncWallet(wallet.id);
    expect(await totals()).toEqual({ spent: 500, income: 1000 });
  });

  it('taxa só como fonte, e menos de um centavo fica só no movimento', async () => {
    const wallet = await addWallet();
    const paid = {
      source_account: WALLET_G,
      fee_account: WALLET_G,
    };
    gateway.setOperations(WALLET_G, [
      // 0,1 XLM de taxa: 25 centavos, vira gasto.
      xlmPayment(WALLET_G, OTHER_G, '1.0000000', {
        transaction_hash: 'tx-cara',
        transaction_attr: { ...paid, fee_charged: '1000000' },
      }),
      // Mesma transação: a taxa não repete.
      xlmPayment(WALLET_G, OTHER_G, '1.0000000', {
        transaction_hash: 'tx-cara',
        transaction_attr: { ...paid, fee_charged: '1000000' },
      }),
      // 100 stroops: bem menos de um centavo.
      xlmPayment(WALLET_G, OTHER_G, '1.0000000', {
        transaction_hash: 'tx-barata',
        transaction_attr: { ...paid, fee_charged: '100' },
      }),
      // Outra conta pagou.
      xlmPayment(OTHER_G, WALLET_G, '1.0000000', {
        transaction_hash: 'tx-alheia',
        transaction_attr: {
          source_account: OTHER_G,
          fee_account: OTHER_G,
          fee_charged: '1000000',
        },
      }),
    ]);

    await sync.syncWallet(wallet.id);

    const movements = await movementsOf(wallet.id);
    const fees = movements.filter((row) => row.opType === 'fee');
    expect(
      fees.map((row) => [row.opId, row.feeStroops, row.valueCents]),
    ).toEqual([
      ['fee:tx-barata', 100n, 0],
      ['fee:tx-cara', 1_000_000n, 25],
    ]);
    const cheap = fees.find((row) => row.opId === 'fee:tx-barata');
    expect(cheap?.expenseId).toBeNull();
    const lines = await linesOf();
    const feeLines = lines.filter((line) => line.merchant.startsWith('Taxa'));
    expect(feeLines.map((line) => [line.category, line.amountCents])).toEqual([
      ['shopping', 25],
    ]);
    // Três envios de 250, a taxa de 25, e a entrada de 250 ficam nos totais.
    expect(await totals()).toEqual({ spent: 775, income: 250 });

    // A lista não mostra a taxa sem linha, mas mostra a que virou gasto.
    const page = await service.movements(membership, { month });
    expect(page.items.filter((row) => row.opType === 'fee')).toHaveLength(1);
    expect(page.items).toHaveLength(5);
  });

  it('carteira M grava só a subconta', async () => {
    const wallet = await addWallet({ muxedId: '42' });
    gateway.setOperations(WALLET_G, [
      xlmPayment(OTHER_G, WALLET_G, '1.0000000', { to_muxed_id: '42' }),
      xlmPayment(OTHER_G, WALLET_G, '1.0000000', { to_muxed_id: '43' }),
      xlmPayment(OTHER_G, WALLET_G, '1.0000000'),
      xlmPayment(WALLET_G, OTHER_G, '1.0000000', {
        from_muxed_id: '43',
        transaction_attr: {
          source_account: WALLET_G,
          source_account_muxed_id: '43',
          fee_account: WALLET_G,
          fee_account_muxed_id: '43',
          fee_charged: '1000000',
        },
      }),
    ]);

    await sync.syncWallet(wallet.id);

    const movements = await movementsOf(wallet.id);
    expect(movements).toHaveLength(1);
    expect(await totals()).toEqual({ spent: 0, income: 250 });
  });

  it('repetir o sync não duplica', async () => {
    const wallet = await addWallet();
    gateway.setOperations(WALLET_G, [
      xlmPayment(OTHER_G, WALLET_G, '100.0000000'),
      xlmPayment(WALLET_G, OTHER_G, '10.0000000'),
    ]);

    await sync.syncWallet(wallet.id);
    await releaseInterval(wallet.id);
    const second = await sync.syncWallet(wallet.id);
    await releaseInterval(wallet.id);
    await sync.syncWallet(wallet.id);

    expect(second?.inserted).toBe(0);
    expect(await movementsOf(wallet.id)).toHaveLength(2);
    expect(await linesOf()).toHaveLength(2);
    expect(await totals()).toEqual({ spent: 2500, income: 25000 });
  });

  it('o intervalo mínimo não chama o Horizon de novo', async () => {
    const wallet = await addWallet();
    gateway.setOperations(WALLET_G, [
      xlmPayment(OTHER_G, WALLET_G, '1.0000000'),
    ]);

    await sync.syncWallet(wallet.id);
    const asked = gateway.calls.operations.length;
    const second = await sync.syncWallet(wallet.id);

    expect(gateway.calls.operations).toHaveLength(asked);
    expect(second?.syncStatus).toBe('ok');
    expect(second?.retryAfterSeconds).toBeGreaterThan(0);
    const saved = await client.householdWallet.findUnique({
      where: { id: wallet.id },
    });
    expect(saved?.syncNotBefore?.getTime()).toBeGreaterThan(
      Date.now() + MIN_SYNC_INTERVAL_MS - 10_000,
    );
  });

  it('dois syncs ao mesmo tempo gravam uma vez só', async () => {
    const wallet = await addWallet();
    gateway.setOperations(WALLET_G, [
      xlmPayment(OTHER_G, WALLET_G, '1.0000000'),
      xlmPayment(OTHER_G, WALLET_G, '2.0000000'),
    ]);

    await Promise.all([sync.syncWallet(wallet.id), sync.syncWallet(wallet.id)]);

    expect(await movementsOf(wallet.id)).toHaveLength(2);
    expect(await linesOf()).toHaveLength(2);
  });

  it('429 no meio vira updating, respeita o Retry-After e depois não falta nem repete movimento', async () => {
    const wallet = await addWallet();
    const operations = Array.from({ length: 450 }, (_, index) =>
      xlmPayment(OTHER_G, WALLET_G, `${index + 1}.0000000`),
    );
    gateway.setOperations(WALLET_G, operations);
    // As chamadas 0 a 2 acham o começo, a 3 grava 200 operações, a 4 leva o 429.
    gateway.failOperationsAt = 4;

    const first = await sync.syncWallet(wallet.id);

    expect(first).toMatchObject({
      syncStatus: 'updating',
      retryAfterSeconds: 120,
    });
    const paused = await client.householdWallet.findUnique({
      where: { id: wallet.id },
    });
    expect(paused?.syncStatus).toBe('updating');
    expect(paused?.syncNotBefore?.getTime()).toBeGreaterThan(
      Date.now() + 100_000,
    );
    const partial = await movementsOf(wallet.id);
    expect(partial).toHaveLength(200);
    expect(paused?.cursor).toBe(operations[199]?.paging_token);

    // Antes do Retry-After, nada de Horizon.
    const asked = gateway.calls.operations.length;
    await sync.syncWallet(wallet.id);
    expect(gateway.calls.operations).toHaveLength(asked);

    gateway.failOperationsAt = null;
    await releaseInterval(wallet.id);
    const second = await sync.syncWallet(wallet.id);

    expect(second?.syncStatus).toBe('ok');
    const all = await movementsOf(wallet.id);
    expect(all).toHaveLength(450);
    expect(new Set(all.map((row) => row.opId)).size).toBe(450);
    expect(await linesOf()).toHaveLength(450);
  });

  it('429 no começo não grava nada e o sync seguinte importa tudo', async () => {
    const wallet = await addWallet();
    gateway.setOperations(WALLET_G, [
      xlmPayment(OTHER_G, WALLET_G, '1.0000000'),
    ]);
    gateway.failOperationsAt = 0;

    expect(await sync.syncWallet(wallet.id)).toMatchObject({
      syncStatus: 'updating',
      inserted: 0,
    });
    expect(await movementsOf(wallet.id)).toEqual([]);

    gateway.failOperationsAt = null;
    await releaseInterval(wallet.id);
    await sync.syncWallet(wallet.id);
    expect(await movementsOf(wallet.id)).toHaveLength(1);
  });

  it.each([
    ['Retry-After curto', new GatewayRateLimitedError(5)],
    ['falha de rede', new GatewayUnavailableError(500)],
  ])('%s ainda respeita o intervalo mínimo', async (_name, failure) => {
    const wallet = await addWallet();
    gateway.failOperationsAt = 0;
    gateway.failWith = failure;

    const outcome = await sync.syncWallet(wallet.id);
    expect(outcome).toMatchObject({
      syncStatus: 'updating',
      retryAfterSeconds: 60,
    });
  });

  it('outro ativo aparece sem valor e fora do total', async () => {
    const wallet = await addWallet();
    gateway.setOperations(WALLET_G, [
      horizonOp({
        type: 'payment',
        from: OTHER_G,
        to: WALLET_G,
        amount: '77.0000000',
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        asset_issuer: OTHER_G,
      }),
    ]);

    await sync.syncWallet(wallet.id);

    expect(await linesOf()).toEqual([]);
    expect(await totals()).toEqual({ spent: 0, income: 0 });
    const page = await service.movements(membership, { month });
    expect(page.items[0]).toMatchObject({
      asset: `USDC (G...${OTHER_G.slice(-4)})`,
      quantity: '77',
      valueCents: null,
      movementClass: 'income',
      canMarkTransfer: false,
    });
    // Sem preço de verdade para esse ativo, ele nunca vira linha.
    await releaseInterval(wallet.id);
    await sync.syncWallet(wallet.id);
    expect(await linesOf()).toEqual([]);
  });

  it('sem preço fica fora do total e entra quando o preço chega', async () => {
    const wallet = await addWallet();
    gateway.setOperations(WALLET_G, [
      xlmPayment(OTHER_G, WALLET_G, '100.0000000'),
    ]);
    const realPtax = gateway.ptaxSell.bind(gateway);
    gateway.breakPrices();

    const outcome = await sync.syncWallet(wallet.id);

    expect(outcome?.syncStatus).toBe('ok');
    expect(await linesOf()).toEqual([]);
    expect(await totals()).toEqual({ spent: 0, income: 0 });
    let page = await service.movements(membership, { month });
    expect(page.items[0]?.valueCents).toBeNull();

    gateway.ptaxSell = realPtax;
    await releaseInterval(wallet.id);
    await sync.syncWallet(wallet.id);

    expect(await totals()).toEqual({ spent: 0, income: 25000 });
    page = await service.movements(membership, { month });
    expect(page.items[0]?.valueCents).toBe(25000);
    expect(page.items[0]?.canMarkTransfer).toBe(true);
  });

  it('fim de semana usa a PTAX do último dia útil, a testnet usa o preço da mainnet e o cache não busca de novo', async () => {
    const wallet = await addWallet({ network: 'testnet' });
    // Sábado 2026-10-03 e domingo 2026-10-04 (12h em São Paulo).
    const saturday = '2026-10-03T15:00:00Z';
    const sunday = '2026-10-04T15:00:00Z';
    gateway.ptax = new Map([
      ['2026-10-01', '5.1000'],
      ['2026-10-02', '5.4000'],
    ]);
    gateway.averages = new Map([
      ['2026-10-03', '0.2000000'],
      ['2026-10-04', '0.3000000'],
    ]);
    gateway.setOperations(WALLET_G, [
      xlmPayment(OTHER_G, WALLET_G, '10.0000000', { created_at: saturday }),
      xlmPayment(OTHER_G, WALLET_G, '10.0000000', { created_at: sunday }),
    ]);
    // A janela de 90 dias não pode cortar estas datas: a data é fixa.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    try {
      await sync.syncWallet(wallet.id);
    } finally {
      vi.useRealTimers();
    }

    const lines = await linesOf();
    // 10 × 0,20 × 5,40 = R$ 10,80 e 10 × 0,30 × 5,40 = R$ 16,20.
    expect(lines.map((line) => line.amountCents).sort()).toEqual([1080, 1620]);
    const cached = await client.assetPriceDaily.findMany({
      where: { asset: 'XLM' },
      orderBy: { date: 'asc' },
    });
    expect(
      cached.map((row) => [
        row.date.toISOString().slice(0, 10),
        row.priceCentsPerUnit.toFixed(2),
      ]),
    ).toEqual([
      ['2026-10-03', '108.00'],
      ['2026-10-04', '162.00'],
    ]);
    // A rede da carteira só vale para as operações; o preço sai sempre da mainnet,
    // como o wallet-gateway.spec confere.
    expect(new Set(gateway.networksAsked)).toEqual(new Set(['testnet']));
    expect(gateway.calls.xlm).toBe(1);

    const ptaxCalls = gateway.calls.ptax;
    const prices = new WalletPricesService(
      db,
      gateway as unknown as WalletGateway,
    );
    const again = await prices.prices([
      { asset: 'XLM', day: '2026-10-03' },
      { asset: 'XLM', day: '2026-10-04' },
    ]);
    expect(again.size).toBe(2);
    expect(gateway.calls.ptax).toBe(ptaxCalls);
    expect(gateway.calls.xlm).toBe(1);
  });

  it('o preço de hoje não fica no cache, porque ainda muda', async () => {
    const prices = new WalletPricesService(
      db,
      gateway as unknown as WalletGateway,
    );
    const result = await prices.prices([{ asset: 'USDC', day: today }]);
    expect(result.get(`USDC|${today}`)).toBe('500.0000000');
    expect(await client.assetPriceDaily.count()).toBe(0);
  });

  it('importação inicial para em 90 dias', async () => {
    const wallet = await addWallet();
    const old = new Date(Date.now() - 91 * 86_400_000).toISOString();
    const recent = new Date(Date.now() - 89 * 86_400_000).toISOString();
    gateway.setOperations(WALLET_G, [
      xlmPayment(OTHER_G, WALLET_G, '1.0000000', { created_at: old }),
      xlmPayment(OTHER_G, WALLET_G, '2.0000000', { created_at: recent }),
      xlmPayment(OTHER_G, WALLET_G, '3.0000000'),
    ]);

    await sync.syncWallet(wallet.id);

    const movements = await movementsOf(wallet.id);
    expect(movements.map((row) => row.quantity?.toFixed(1))).toEqual([
      '2.0',
      '3.0',
    ]);
  });

  it('só com operação velha, não importa nada e não anda de novo', async () => {
    const wallet = await addWallet();
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString();
    const operation = xlmPayment(OTHER_G, WALLET_G, '1.0000000', {
      created_at: old,
    });
    gateway.setOperations(WALLET_G, [operation]);

    await sync.syncWallet(wallet.id);

    expect(await movementsOf(wallet.id)).toEqual([]);
    const saved = await client.householdWallet.findUnique({
      where: { id: wallet.id },
    });
    expect(saved?.cursor).toBe(operation.paging_token);
    expect(saved?.syncStatus).toBe('ok');

    await releaseInterval(wallet.id);
    const newer = xlmPayment(OTHER_G, WALLET_G, '9.0000000');
    gateway.setOperations(WALLET_G, [operation, newer]);
    await sync.syncWallet(wallet.id);
    expect(await movementsOf(wallet.id)).toHaveLength(1);
  });

  it('importação inicial para em 1000 operações, as mais recentes, e segue sem falha depois', async () => {
    const wallet = await addWallet();
    const operations = Array.from({ length: 1200 }, () =>
      xlmPayment(OTHER_G, WALLET_G, '1.0000000'),
    );
    gateway.setOperations(WALLET_G, operations);

    const first = await sync.syncWallet(wallet.id);

    const movements = await movementsOf(wallet.id);
    expect(movements).toHaveLength(1000);
    expect(movements.map((row) => row.opId)).not.toContain(operations[199]?.id);
    expect(movements.map((row) => row.opId)).toContain(operations[200]?.id);
    expect(movements.map((row) => row.opId)).toContain(operations[1199]?.id);
    expect(first?.syncStatus).toBe('updating');

    await releaseInterval(wallet.id);
    const newer = xlmPayment(OTHER_G, WALLET_G, '1.0000000');
    gateway.setOperations(WALLET_G, [...operations, newer]);
    const second = await sync.syncWallet(wallet.id);
    expect(second?.syncStatus).toBe('ok');
    expect(await movementsOf(wallet.id)).toHaveLength(1001);
  }, 60_000);

  it('transferência minha tira do total e desmarcar devolve', async () => {
    const wallet = await addWallet();
    gateway.setOperations(WALLET_G, [
      xlmPayment(WALLET_G, OTHER_G, '10.0000000'),
    ]);
    await sync.syncWallet(wallet.id);
    expect((await totals()).spent).toBe(2500);
    const [movement] = await movementsOf(wallet.id);

    await service.markOwnTransfer(membership, movement!.id, {
      ownTransfer: true,
    });
    const marked = await client.expense.findUnique({
      where: { id: movement!.expenseId as string },
    });
    expect(marked?.excludedFromTotals).toBe(true);
    expect((await totals()).spent).toBe(0);
    let page = await service.movements(membership, { month });
    expect(page.items[0]?.ownTransfer).toBe(true);

    await service.markOwnTransfer(membership, movement!.id, {
      ownTransfer: false,
    });
    expect((await totals()).spent).toBe(2500);
    page = await service.movements(membership, { month });
    expect(page.items[0]?.ownTransfer).toBe(false);
  });

  it('remover a carteira tira movimentos e linhas do painel, e deixa os outros lançamentos', async () => {
    const wallet = await addWallet();
    gateway.setOperations(WALLET_G, [
      xlmPayment(OTHER_G, WALLET_G, '100.0000000'),
      xlmPayment(WALLET_G, OTHER_G, '10.0000000'),
    ]);
    await sync.syncWallet(wallet.id);
    await client.expense.create({
      data: {
        householdId: membership.householdId,
        addedByCompanyId: membership.companyId,
        spentOn: new Date(`${today}T00:00:00.000Z`),
        merchant: 'Mercado',
        category: 'groceries',
        fixed: false,
        amountCents: 700,
      },
    });

    await service.remove(membership, wallet.id);

    expect(await movementsOf(wallet.id)).toEqual([]);
    expect(await linesOf()).toEqual([]);
    expect(await totals()).toEqual({ spent: 700, income: 0 });
    expect((await service.movements(membership, { month })).items).toEqual([]);
  });

  it('o endereço não aparece em nenhum log do sync', async () => {
    const logs = captureLogs();
    try {
      const wallet = await addWallet();
      gateway.setOperations(WALLET_G, [
        xlmPayment(OTHER_G, WALLET_G, '1.0000000'),
      ]);
      gateway.failOperationsAt = 0;
      await sync.syncWallet(wallet.id);
      gateway.failOperationsAt = null;
      await releaseInterval(wallet.id);
      gateway.breakPrices();
      await sync.syncWallet(wallet.id);
      gateway.failOperationsAt = 0;
      gateway.failWith = new GatewayUnavailableError(500);
      await releaseInterval(wallet.id);
      await sync.syncWallet(wallet.id);

      expect(logs.count()).toBeGreaterThan(0);
      expect(logs.text()).not.toContain(WALLET_G);
    } finally {
      logs.restore();
    }
  });

  it('a coluna de quantidade guarda 7 casas', async () => {
    const wallet = await addWallet();
    gateway.setOperations(WALLET_G, [
      xlmPayment(OTHER_G, WALLET_G, '0.0000001'),
    ]);
    await sync.syncWallet(wallet.id);
    const [movement] = await movementsOf(wallet.id);
    expect(movement?.quantity).toBeInstanceOf(Prisma.Decimal);
    expect(movement?.quantity?.toFixed(7)).toBe('0.0000001');
    // Menos de um centavo: sem linha, com valor zero.
    expect(movement?.valueCents).toBe(0);
    expect(movement?.expenseId).toBeNull();
  });
});
