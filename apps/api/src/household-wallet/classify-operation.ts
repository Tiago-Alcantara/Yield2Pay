import type { WalletMovementClass, WalletNetwork } from '@yield2pay/shared';
import { saoPauloToday } from '../summary/summary.math';
import { stroopsToQuantity } from './wallet-money';

/** Emissor do USDC da Circle em cada rede. Outro emissor não é USDC para nós. */
export const USDC_CIRCLE_ISSUER: Record<WalletNetwork, string> = {
  public: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  testnet: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
};

export type HorizonTransaction = {
  hash?: string;
  source_account?: string;
  source_account_muxed_id?: string;
  fee_account?: string;
  fee_account_muxed_id?: string;
  fee_charged?: string | number;
  fee_bump_transaction?: unknown;
};

/** Campos que o Horizon manda por tipo de operação. Só o que usamos aqui. */
export type HorizonOperation = {
  id: string;
  paging_token: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  transaction_successful?: boolean;
  source_account?: string;
  source_account_muxed_id?: string;
  from?: string;
  from_muxed_id?: string;
  to?: string;
  to_muxed_id?: string;
  funder?: string;
  funder_muxed_id?: string;
  account?: string;
  account_muxed_id?: string;
  into?: string;
  into_muxed_id?: string;
  claimant?: string;
  claimant_muxed_id?: string;
  amount?: string;
  source_amount?: string;
  starting_balance?: string;
  /** Em create_claimable_balance vem como "native" ou "CODIGO:EMISSOR". */
  asset?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  source_asset_type?: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  transaction_attr?: HorizonTransaction;
};

export type HorizonEffect = {
  type: string;
  account?: string;
  amount?: string;
  /** Em claimable_balance_claimed vem como "native" ou "CODIGO:EMISSOR". */
  asset?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  bought_amount?: string;
  bought_asset_type?: string;
  bought_asset_code?: string;
  bought_asset_issuer?: string;
};

export type WalletRef = {
  network: WalletNetwork;
  accountId: string;
  muxedId: string | null;
};

export type MovementDraft = {
  opId: string;
  txHash: string;
  occurredOn: string;
  opType: string;
  direction: 'in' | 'out' | 'none';
  asset: string | null;
  quantity: string | null;
  feeStroops: string | null;
  movementClass: WalletMovementClass;
};

const OFFER_TYPES = new Set([
  'manage_sell_offer',
  'manage_buy_offer',
  'create_passive_sell_offer',
]);

/** Só estes tipos precisam de effects para saber o valor ou se houve troca. */
export function needsEffects(op: HorizonOperation): boolean {
  return (
    op.type === 'account_merge' ||
    op.type === 'claim_claimable_balance' ||
    OFFER_TYPES.has(op.type)
  );
}

/** 'XLM', 'USDC' da Circle ou 'CODIGO:EMISSOR'. */
function assetKey(
  network: WalletNetwork,
  type: string | undefined,
  code: string | undefined,
  issuer: string | undefined,
): string | null {
  if (type === 'native') return 'XLM';
  if (!code || !issuer) return null;
  if (code === 'USDC' && issuer === USDC_CIRCLE_ISSUER[network]) return 'USDC';
  return `${code}:${issuer}`;
}

function assetKeyFromText(
  network: WalletNetwork,
  text: string | undefined,
): string | null {
  if (!text) return null;
  if (text === 'native') return 'XLM';
  const [code, issuer] = text.split(':');
  return assetKey(network, 'credit', code, issuer);
}

/** XLM e USDC da Circle têm preço. Os outros ficam "sem valor em reais". */
export function isPricedAsset(asset: string | null): asset is 'XLM' | 'USDC' {
  return asset === 'XLM' || asset === 'USDC';
}

function matches(
  wallet: WalletRef,
  base: string | undefined,
  muxedId: string | undefined,
): boolean {
  if (base !== wallet.accountId) return false;
  return wallet.muxedId == null || String(muxedId) === wallet.muxedId;
}

/** Numa carteira M, só entra a operação com aquele muxed id em algum campo. */
function involvesWallet(op: HorizonOperation, wallet: WalletRef): boolean {
  if (wallet.muxedId == null) return true;
  return [
    op.source_account_muxed_id,
    op.from_muxed_id,
    op.to_muxed_id,
    op.funder_muxed_id,
    op.account_muxed_id,
    op.into_muxed_id,
    op.claimant_muxed_id,
  ].some((id) => id != null && String(id) === wallet.muxedId);
}

function occurredOn(op: HorizonOperation): string {
  return saoPauloToday(new Date(op.created_at));
}

function draft(
  op: HorizonOperation,
  fields: Pick<MovementDraft, 'direction' | 'movementClass'> &
    Partial<Pick<MovementDraft, 'asset' | 'quantity'>>,
): MovementDraft {
  return {
    opId: op.id,
    txHash: op.transaction_hash,
    occurredOn: occurredOn(op),
    opType: op.type,
    asset: null,
    quantity: null,
    feeStroops: null,
    ...fields,
  };
}

const info = (op: HorizonOperation) =>
  draft(op, { direction: 'none', movementClass: 'info' });

function flow(
  op: HorizonOperation,
  direction: 'in' | 'out',
  asset: string | null,
  quantity: string | null,
): MovementDraft {
  return draft(op, {
    direction,
    movementClass: direction === 'in' ? 'income' : 'expense',
    asset,
    quantity,
  });
}

function classifyPayment(op: HorizonOperation, wallet: WalletRef) {
  const sent = matches(wallet, op.from, op.from_muxed_id);
  const received = matches(wallet, op.to, op.to_muxed_id);
  const asset = assetKey(
    wallet.network,
    op.asset_type,
    op.asset_code,
    op.asset_issuer,
  );
  // Pagamento para a própria conta não muda nada.
  if (sent === received) return info(op);
  return flow(op, received ? 'in' : 'out', asset, op.amount ?? null);
}

function classifyPathPayment(op: HorizonOperation, wallet: WalletRef) {
  const sent = matches(wallet, op.from, op.from_muxed_id);
  const received = matches(wallet, op.to, op.to_muxed_id);
  const destination = assetKey(
    wallet.network,
    op.asset_type,
    op.asset_code,
    op.asset_issuer,
  );
  if (sent && received) {
    return draft(op, {
      direction: 'none',
      movementClass: 'conversion',
      asset: destination,
      quantity: op.amount ?? null,
    });
  }
  if (received) return flow(op, 'in', destination, op.amount ?? null);
  if (sent) {
    const source = assetKey(
      wallet.network,
      op.source_asset_type,
      op.source_asset_code,
      op.source_asset_issuer,
    );
    return flow(op, 'out', source, op.source_amount ?? null);
  }
  return info(op);
}

/** Crédito ou débito efetivo da conta, nos effects da operação. */
function effectiveAmount(
  effects: HorizonEffect[],
  wallet: WalletRef,
  type: 'account_credited' | 'account_debited',
) {
  const effect = effects.find(
    (item) => item.type === type && item.account === wallet.accountId,
  );
  if (!effect) return null;
  return {
    asset: assetKey(
      wallet.network,
      effect.asset_type,
      effect.asset_code,
      effect.asset_issuer,
    ),
    quantity: effect.amount ?? null,
  };
}

function classifyMerge(
  op: HorizonOperation,
  wallet: WalletRef,
  effects: HorizonEffect[],
) {
  if (matches(wallet, op.into, op.into_muxed_id)) {
    const credit = effectiveAmount(effects, wallet, 'account_credited');
    return flow(op, 'in', 'XLM', credit?.quantity ?? null);
  }
  if (matches(wallet, op.account, op.account_muxed_id)) {
    const debit = effectiveAmount(effects, wallet, 'account_debited');
    return flow(op, 'out', 'XLM', debit?.quantity ?? null);
  }
  return info(op);
}

function classifyClaim(
  op: HorizonOperation,
  wallet: WalletRef,
  effects: HorizonEffect[],
) {
  if (!matches(wallet, op.claimant, op.claimant_muxed_id)) return info(op);
  const credit = effectiveAmount(effects, wallet, 'account_credited');
  if (credit) return flow(op, 'in', credit.asset, credit.quantity);
  const claimed = effects.find(
    (item) => item.type === 'claimable_balance_claimed',
  );
  return flow(
    op,
    'in',
    assetKeyFromText(wallet.network, claimed?.asset),
    claimed?.amount ?? null,
  );
}

/** Oferta só vira conversão se a operação casou com alguma ordem. */
function classifyOffer(
  op: HorizonOperation,
  wallet: WalletRef,
  effects: HorizonEffect[],
) {
  const trades = effects.filter(
    (item) => item.type === 'trade' && item.account === wallet.accountId,
  );
  const first = trades[0];
  if (!first) return info(op);
  return draft(op, {
    direction: 'none',
    movementClass: 'conversion',
    asset: assetKey(
      wallet.network,
      first.bought_asset_type,
      first.bought_asset_code,
      first.bought_asset_issuer,
    ),
    quantity: first.bought_amount ?? null,
  });
}

/**
 * Traduz uma operação em movimento. Nulo: não entra nesta carteira (outra subconta
 * M, ou transação que falhou).
 */
export function classifyOperation(
  op: HorizonOperation,
  wallet: WalletRef,
  effects: HorizonEffect[] = [],
): MovementDraft | null {
  if (op.transaction_successful === false) return null;
  if (!involvesWallet(op, wallet)) return null;
  switch (op.type) {
    case 'payment':
      return classifyPayment(op, wallet);
    case 'path_payment_strict_receive':
    case 'path_payment_strict_send':
      return classifyPathPayment(op, wallet);
    case 'create_account':
      if (matches(wallet, op.funder, op.funder_muxed_id)) {
        return flow(op, 'out', 'XLM', op.starting_balance ?? null);
      }
      if (op.account === wallet.accountId) {
        return flow(op, 'in', 'XLM', op.starting_balance ?? null);
      }
      return info(op);
    case 'account_merge':
      return classifyMerge(op, wallet, effects);
    case 'create_claimable_balance':
      // Criar é gasto. Quem só é beneficiário recebe no resgate, não aqui.
      if (matches(wallet, op.source_account, op.source_account_muxed_id)) {
        return flow(
          op,
          'out',
          assetKeyFromText(wallet.network, op.asset),
          op.amount ?? null,
        );
      }
      return info(op);
    case 'claim_claimable_balance':
      return classifyClaim(op, wallet, effects);
    default:
      if (OFFER_TYPES.has(op.type)) return classifyOffer(op, wallet, effects);
      return info(op);
  }
}

/**
 * Taxa da transação, só se esta carteira pagou. fee_account é a fonte da transação
 * ou, com fee-bump, a fonte do fee-bump. Numa carteira M a fonte muxed precisa ser a dela.
 */
export function feeMovement(
  op: HorizonOperation,
  wallet: WalletRef,
): MovementDraft | null {
  if (op.transaction_successful === false) return null;
  const tx = op.transaction_attr;
  if (!tx) return null;
  const payer = tx.fee_account ?? tx.source_account;
  if (payer !== wallet.accountId) return null;
  if (wallet.muxedId != null) {
    const payerMuxed =
      tx.fee_account_muxed_id ??
      (tx.fee_bump_transaction ? undefined : tx.source_account_muxed_id);
    if (String(payerMuxed) !== wallet.muxedId) return null;
  }
  const charged = String(tx.fee_charged ?? '0');
  if (!/^\d+$/.test(charged) || BigInt(charged) <= 0n) return null;
  return {
    opId: `fee:${op.transaction_hash}`,
    txHash: op.transaction_hash,
    occurredOn: occurredOn(op),
    opType: 'fee',
    direction: 'out',
    asset: 'XLM',
    quantity: stroopsToQuantity(charged),
    feeStroops: charged,
    movementClass: 'expense',
  };
}
