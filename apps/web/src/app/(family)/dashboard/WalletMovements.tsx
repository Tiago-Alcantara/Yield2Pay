'use client';

import { useEffect, useRef, useState } from 'react';
import type { WalletMovementView, WalletSyncResult } from '@yield2pay/shared';
import { Button } from '@/components/Button';
import { createHouseholdApi, WALLET_REQUEST_TIMEOUT_MS } from '../_lib/householdApi';
import { brl, reais, signedBrl } from './painel-format';

type GetToken = () => Promise<string | null>;
type MovementFilter = 'todos' | 'gastos' | 'entradas' | 'conversoes' | 'info' | 'sem-valor' | 'transferencia';

const FILTERS: { id: MovementFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'entradas', label: 'Entradas' },
  { id: 'conversoes', label: 'Conversões' },
  { id: 'info', label: 'Informativos' },
  { id: 'sem-valor', label: 'Sem valor' },
  { id: 'transferencia', label: 'Transferência minha' },
];

const OPERATION_LABEL: Record<string, string> = {
  payment: 'Pagamento',
  path_payment_strict_receive: 'Pagamento com troca',
  path_payment_strict_send: 'Pagamento com troca',
  create_account: 'Criação de conta',
  account_merge: 'Encerramento de conta',
  create_claimable_balance: 'Saldo a resgatar',
  claim_claimable_balance: 'Resgate de saldo',
  change_trust: 'Autorização de ativo',
  set_options: 'Ajuste da conta',
  manage_sell_offer: 'Oferta',
  manage_buy_offer: 'Oferta',
  create_passive_sell_offer: 'Oferta',
  fee: 'Taxa da rede',
};

const DIRECTION_LABEL = { in: 'Recebido', out: 'Enviado', none: '' } as const;
const CLASS_LABEL = { conversion: 'Conversão', info: 'Informativo', expense: '', income: '' } as const;

export function matchesMovement(row: WalletMovementView, filter: MovementFilter): boolean {
  switch (filter) {
    case 'gastos': return row.movementClass === 'expense';
    case 'entradas': return row.movementClass === 'income';
    case 'conversoes': return row.movementClass === 'conversion';
    case 'info': return row.movementClass === 'info';
    case 'sem-valor': return row.valueCents == null;
    case 'transferencia': return row.ownTransfer;
    default: return true;
  }
}

function typeOf(row: WalletMovementView): string {
  const operation = OPERATION_LABEL[row.opType] ?? 'Outra operação';
  const detail = CLASS_LABEL[row.movementClass] || DIRECTION_LABEL[row.direction];
  return detail ? `${operation} · ${detail}` : operation;
}

function valueOf(row: WalletMovementView): string {
  if (row.valueCents == null) return 'sem valor em reais';
  if (row.valueCents === 0) return 'menos de 1 centavo';
  return row.movementClass === 'income' ? signedBrl(row.valueCents) : brl(reais(row.valueCents));
}

/**
 * Movimentos das carteiras do grupo. O sync roda ao abrir e no botão atualizar; não
 * há cron. Falha de rede nunca vira erro na tela: a API diz 'updating' e o painel
 * pede de novo depois do tempo que ela indicar.
 */
export function WalletMovements({
  month,
  from,
  to,
  reloadKey,
  getToken,
  getIdentityToken,
  onExpensesChanged,
}: {
  month: string;
  from?: string;
  to?: string;
  reloadKey: number;
  getToken: GetToken;
  getIdentityToken?: () => Promise<string | null>;
  onExpensesChanged?: () => void;
}) {
  const [items, setItems] = useState<WalletMovementView[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasWallets, setHasWallets] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [filter, setFilter] = useState<MovementFilter>('todos');
  const [note, setNote] = useState('');
  const latest = useRef({ getToken, getIdentityToken, onExpensesChanged, month, from, to });
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    latest.current = { getToken, getIdentityToken, onExpensesChanged, month, from, to };
  });

  function api() {
    return createHouseholdApi(() => latest.current.getToken(), {
      getIdentityToken: latest.current.getIdentityToken,
      timeoutMs: WALLET_REQUEST_TIMEOUT_MS,
    });
  }

  async function loadMovements() {
    const { month: currentMonth, from: start, to: end } = latest.current;
    try {
      const page = await api().getWalletMovements({ month: currentMonth, from: start, to: end });
      if (!mounted.current) return;
      // A API antiga e os testes sem esta rota não devolvem o formato de página.
      setItems(page?.items ?? []);
      setTruncated(page?.truncated === true);
    } catch {
      if (mounted.current) setItems([]);
    }
  }

  async function syncNow() {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    let result: WalletSyncResult | undefined;
    try {
      result = await api().syncWallets();
    } catch {
      return;
    }
    if (!mounted.current) return;
    const wallets = result?.wallets ?? [];
    setHasWallets(wallets.length > 0);
    const pending = wallets.filter((wallet) => wallet.syncStatus !== 'ok');
    setUpdating(pending.length > 0);
    if (result?.changed) {
      await loadMovements();
      latest.current.onExpensesChanged?.();
    }
    if (pending.length > 0 && mounted.current) {
      const wait = Math.max(...pending.map((wallet) => wallet.retryAfterSeconds ?? 60), 1);
      retryTimer.current = setTimeout(() => void syncNow(), wait * 1000);
    }
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  useEffect(() => {
    void syncNow();
    // reloadKey: carteira adicionada ou removida na Conta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useEffect(() => {
    void loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, from, to, reloadKey]);

  async function toggleTransfer(row: WalletMovementView) {
    try {
      await api().markWalletTransfer(row.id, !row.ownTransfer);
      setNote('');
      await loadMovements();
      latest.current.onExpensesChanged?.();
    } catch {
      setNote('Não foi possível marcar a transferência.');
    }
  }

  if (!hasWallets && items.length === 0) return null;

  const list = items.filter((row) => matchesMovement(row, filter));

  return (
    <div id="s-carteiras" data-reveal className="y2p-dashboard__section y2p-section" data-screen-label="Carteiras">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="y2p-section-h">Movimentos das carteiras</h2>
          <p className="y2p-section-sub">
            {list.length === 1 ? '1 movimento' : list.length + ' movimentos'}
            {updating ? ' · atualizando…' : ''}
          </p>
          {truncated && <p role="status" className="y2p-note">Mostramos só os 1.000 movimentos mais recentes do período.</p>}
          {note && <p role="status" className="y2p-note">{note}</p>}
        </div>
        <Button variant="secondary" size="sm" onClick={() => void syncNow()}>Atualizar</Button>
      </div>
      <div className="y2p-chips" role="group" aria-label="Filtrar movimentos" style={{ marginTop: 12 }}>
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={'y2p-chip' + (filter === item.id ? ' is-on' : '')}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="y2p-list y2p-card-plain">
        {list.length === 0 && <p className="y2p-wallet__empty">Nenhum movimento neste filtro.</p>}
        {list.map((row) => (
          <div key={row.id} className="y2p-wallet">
            <span className="y2p-mono y2p-wallet__date">{row.date.slice(8, 10) + '/' + row.date.slice(5, 7)}</span>
            <span className="y2p-wallet__main">
              <span className="y2p-ellipsis">{row.origin}</span>
              <span className="y2p-wallet__type">{typeOf(row)}</span>
            </span>
            <span className="y2p-mono y2p-wallet__asset">
              {row.quantity != null && row.asset ? row.quantity + ' ' + row.asset : '—'}
            </span>
            <span className={'y2p-num y2p-wallet__value' + (row.movementClass === 'income' && row.valueCents ? ' y2p-tx__amount--income' : '')}>
              {valueOf(row)}
            </span>
            {row.canMarkTransfer ? (
              <button
                type="button"
                className={'y2p-chip' + (row.ownTransfer ? ' is-on' : '')}
                aria-pressed={row.ownTransfer}
                onClick={() => void toggleTransfer(row)}
              >
                Transferência minha
              </button>
            ) : (
              <span className="y2p-wallet__mark">{row.ownTransfer ? 'Transferência minha' : ''}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
