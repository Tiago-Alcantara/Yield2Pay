/**
 * Módulo: classify-operation
 * Criado em: 2026-11-04
 * Última atualização: 2026-11-04
 * Intuito: Cada operação do Horizon vira a classe certa, e a taxa só entra para quem pagou.
 * Sequência: recebido é entrada e enviado é gasto; pagamento para si mesmo é info; path payment usa o ativo de cada lado e, para a própria conta, é conversão; create_account e account_merge usam o valor efetivo; claimable é gasto para quem cria, info para o beneficiário, e entrada só no resgate; oferta que casou é conversão e oferta parada é info; trustline, set_options e o resto são info; outro emissor de USDC não vira USDC; transação que falhou não entra; carteira M vê só as operações da subconta; taxa só como fonte da transação ou do fee-bump, e na M só com a fonte muxed dela.
 */
import { WALLET_G, OTHER_G, horizonOp } from '../../test/wallet-fixtures';
import {
  classifyOperation,
  feeMovement,
  isPricedAsset,
  USDC_CIRCLE_ISSUER,
  type WalletRef,
} from './classify-operation';

const wallet: WalletRef = {
  network: 'public',
  accountId: WALLET_G,
  muxedId: null,
};
const subaccount: WalletRef = { ...wallet, muxedId: '42' };
const USDC = {
  asset_type: 'credit_alphanum4',
  asset_code: 'USDC',
  asset_issuer: USDC_CIRCLE_ISSUER.public,
};

function payment(from: string, to: string, extra = {}) {
  return horizonOp({
    type: 'payment',
    from,
    to,
    amount: '10.0000000',
    asset_type: 'native',
    ...extra,
  });
}

describe('classifyOperation', () => {
  it('recebido é entrada e enviado é gasto', () => {
    expect(classifyOperation(payment(OTHER_G, WALLET_G), wallet)).toMatchObject(
      {
        direction: 'in',
        movementClass: 'income',
        asset: 'XLM',
        quantity: '10.0000000',
      },
    );
    expect(
      classifyOperation(payment(WALLET_G, OTHER_G, USDC), wallet),
    ).toMatchObject({
      direction: 'out',
      movementClass: 'expense',
      asset: 'USDC',
    });
  });

  it('pagamento para si mesmo é info', () => {
    expect(
      classifyOperation(payment(WALLET_G, WALLET_G), wallet),
    ).toMatchObject({ direction: 'none', movementClass: 'info' });
  });

  it('path payment usa o ativo de cada lado e, para a própria conta, é conversão', () => {
    const path = {
      type: 'path_payment_strict_send',
      amount: '5.0000000',
      source_amount: '20.0000000',
      ...USDC,
      source_asset_type: 'native',
    };
    expect(
      classifyOperation(
        horizonOp({ ...path, from: WALLET_G, to: OTHER_G }),
        wallet,
      ),
    ).toMatchObject({
      movementClass: 'expense',
      asset: 'XLM',
      quantity: '20.0000000',
    });
    expect(
      classifyOperation(
        horizonOp({ ...path, from: OTHER_G, to: WALLET_G }),
        wallet,
      ),
    ).toMatchObject({
      movementClass: 'income',
      asset: 'USDC',
      quantity: '5.0000000',
    });
    expect(
      classifyOperation(
        horizonOp({
          ...path,
          type: 'path_payment_strict_receive',
          from: WALLET_G,
          to: WALLET_G,
        }),
        wallet,
      ),
    ).toMatchObject({ movementClass: 'conversion', direction: 'none' });
  });

  it('create_account e account_merge usam o valor efetivo', () => {
    const created = {
      type: 'create_account',
      starting_balance: '2.0000000',
    };
    expect(
      classifyOperation(
        horizonOp({ ...created, funder: WALLET_G, account: OTHER_G }),
        wallet,
      ),
    ).toMatchObject({ movementClass: 'expense', quantity: '2.0000000' });
    expect(
      classifyOperation(
        horizonOp({ ...created, funder: OTHER_G, account: WALLET_G }),
        wallet,
      ),
    ).toMatchObject({ movementClass: 'income', asset: 'XLM' });

    const merge = horizonOp({
      type: 'account_merge',
      account: OTHER_G,
      into: WALLET_G,
    });
    expect(
      classifyOperation(merge, wallet, [
        { type: 'account_credited', account: WALLET_G, amount: '7.5000000' },
        { type: 'account_debited', account: OTHER_G, amount: '7.5000000' },
      ]),
    ).toMatchObject({ movementClass: 'income', quantity: '7.5000000' });
    expect(
      classifyOperation(
        horizonOp({ type: 'account_merge', account: WALLET_G, into: OTHER_G }),
        wallet,
        [{ type: 'account_debited', account: WALLET_G, amount: '3.0000000' }],
      ),
    ).toMatchObject({ movementClass: 'expense', quantity: '3.0000000' });
  });

  it('claimable é gasto para quem cria, info para o beneficiário, e entrada só no resgate', () => {
    const asset = `USDC:${USDC_CIRCLE_ISSUER.public}`;
    const creation = {
      type: 'create_claimable_balance',
      asset,
      amount: '9.0000000',
    };
    expect(
      classifyOperation(
        horizonOp({ ...creation, source_account: WALLET_G }),
        wallet,
      ),
    ).toMatchObject({
      movementClass: 'expense',
      asset: 'USDC',
      quantity: '9.0000000',
    });
    expect(
      classifyOperation(
        horizonOp({ ...creation, source_account: OTHER_G }),
        wallet,
      ),
    ).toMatchObject({ movementClass: 'info', asset: null, quantity: null });

    const claim = horizonOp({
      type: 'claim_claimable_balance',
      claimant: WALLET_G,
    });
    expect(
      classifyOperation(claim, wallet, [
        {
          type: 'account_credited',
          account: WALLET_G,
          amount: '9.0000000',
          ...USDC,
        },
      ]),
    ).toMatchObject({
      movementClass: 'income',
      asset: 'USDC',
      quantity: '9.0000000',
    });
    expect(
      classifyOperation(claim, wallet, [
        { type: 'claimable_balance_claimed', asset, amount: '9.0000000' },
      ]),
    ).toMatchObject({ movementClass: 'income', asset: 'USDC' });
  });

  it('oferta que casou é conversão e oferta parada é info', () => {
    const offer = horizonOp({ type: 'manage_sell_offer' });
    expect(classifyOperation(offer, wallet, [])).toMatchObject({
      movementClass: 'info',
    });
    expect(
      classifyOperation(offer, wallet, [
        {
          type: 'trade',
          account: WALLET_G,
          bought_amount: '4.0000000',
          bought_asset_type: 'native',
        },
      ]),
    ).toMatchObject({
      movementClass: 'conversion',
      asset: 'XLM',
      quantity: '4.0000000',
    });
  });

  it.each([
    'change_trust',
    'set_options',
    'manage_buy_offer',
    'create_passive_sell_offer',
    'manage_data',
    'invoke_host_function',
  ])('%s é info e fica sem valor', (type) => {
    expect(classifyOperation(horizonOp({ type }), wallet)).toMatchObject({
      movementClass: 'info',
      asset: null,
      quantity: null,
    });
  });

  it('outro emissor de USDC não vira USDC', () => {
    const fake = classifyOperation(
      payment(OTHER_G, WALLET_G, { ...USDC, asset_issuer: OTHER_G }),
      wallet,
    );
    expect(fake?.asset).toBe(`USDC:${OTHER_G}`);
    expect(isPricedAsset(fake?.asset ?? null)).toBe(false);
    // O emissor da mainnet não é o USDC da Circle na testnet, e vice-versa.
    const testnet = classifyOperation(payment(OTHER_G, WALLET_G, USDC), {
      ...wallet,
      network: 'testnet',
    });
    expect(testnet?.asset).toBe(`USDC:${USDC_CIRCLE_ISSUER.public}`);
    expect(isPricedAsset('XLM')).toBe(true);
    expect(isPricedAsset('USDC')).toBe(true);
  });

  it('transação que falhou não entra', () => {
    const failed = payment(OTHER_G, WALLET_G, {
      transaction_successful: false,
    });
    expect(classifyOperation(failed, wallet)).toBeNull();
    expect(feeMovement(failed, wallet)).toBeNull();
  });

  it('carteira M vê só as operações da subconta', () => {
    const mine = payment(OTHER_G, WALLET_G, { to_muxed_id: '42' });
    const other = payment(OTHER_G, WALLET_G, { to_muxed_id: '43' });
    const plain = payment(OTHER_G, WALLET_G);
    expect(classifyOperation(mine, subaccount)).toMatchObject({
      movementClass: 'income',
    });
    expect(classifyOperation(other, subaccount)).toBeNull();
    expect(classifyOperation(plain, subaccount)).toBeNull();
    // A conta G enxerga as duas subcontas.
    expect(classifyOperation(other, wallet)).toMatchObject({
      movementClass: 'income',
    });
    // Entre subcontas, para a 42 é uma entrada.
    const between = payment(WALLET_G, WALLET_G, {
      from_muxed_id: '43',
      to_muxed_id: '42',
    });
    expect(classifyOperation(between, subaccount)).toMatchObject({
      movementClass: 'income',
    });
    expect(classifyOperation(between, wallet)).toMatchObject({
      movementClass: 'info',
    });
  });
});

describe('feeMovement', () => {
  const tx = (fields: object) =>
    payment(OTHER_G, WALLET_G, {
      transaction_hash: 'abc',
      transaction_attr: { fee_charged: '5000000', ...fields },
    });

  it('entra como gasto em XLM quando a carteira é a fonte', () => {
    expect(
      feeMovement(
        tx({ source_account: WALLET_G, fee_account: WALLET_G }),
        wallet,
      ),
    ).toMatchObject({
      opId: 'fee:abc',
      opType: 'fee',
      movementClass: 'expense',
      asset: 'XLM',
      quantity: '0.5000000',
      feeStroops: '5000000',
    });
  });

  it('fica de fora quando outra conta é a fonte', () => {
    expect(
      feeMovement(
        tx({ source_account: OTHER_G, fee_account: OTHER_G }),
        wallet,
      ),
    ).toBeNull();
  });

  it('com fee-bump, paga quem assinou o fee-bump', () => {
    const bump = { fee_bump_transaction: { hash: 'x' } };
    expect(
      feeMovement(
        tx({ source_account: OTHER_G, fee_account: WALLET_G, ...bump }),
        wallet,
      ),
    ).not.toBeNull();
    expect(
      feeMovement(
        tx({ source_account: WALLET_G, fee_account: OTHER_G, ...bump }),
        wallet,
      ),
    ).toBeNull();
  });

  it('na carteira M, só com a fonte muxed dela', () => {
    const paid = (id: string) =>
      tx({
        source_account: WALLET_G,
        source_account_muxed_id: id,
        fee_account: WALLET_G,
        fee_account_muxed_id: id,
      });
    expect(feeMovement(paid('42'), subaccount)).not.toBeNull();
    expect(feeMovement(paid('43'), subaccount)).toBeNull();
    expect(
      feeMovement(
        tx({ source_account: WALLET_G, fee_account: WALLET_G }),
        subaccount,
      ),
    ).toBeNull();
    // Sem o campo do fee, vale a fonte da transação.
    expect(
      feeMovement(
        tx({
          source_account: WALLET_G,
          source_account_muxed_id: '42',
          fee_account: WALLET_G,
        }),
        subaccount,
      ),
    ).not.toBeNull();
    // Com fee-bump, a fonte interna não conta.
    expect(
      feeMovement(
        tx({
          source_account: WALLET_G,
          source_account_muxed_id: '42',
          fee_account: WALLET_G,
          fee_bump_transaction: { hash: 'x' },
        }),
        subaccount,
      ),
    ).toBeNull();
  });

  it('sem o tx embutido ou sem taxa, não há movimento', () => {
    expect(
      feeMovement(
        horizonOp({ type: 'payment', transaction_attr: undefined }),
        wallet,
      ),
    ).toBeNull();
    expect(
      feeMovement(tx({ fee_account: WALLET_G, fee_charged: '0' }), wallet),
    ).toBeNull();
  });
});
