'use client';

import { useEffect, useState } from 'react';
import type { HouseholdWalletView, WalletNetwork } from '@yield2pay/shared';
import { createHouseholdApi, WALLET_REQUEST_TIMEOUT_MS } from '../_lib/householdApi';

type GetToken = () => Promise<string | null>;

const STATUS_LABEL = {
  pending: 'Aguardando a primeira leitura',
  updating: 'Atualizando…',
  ok: 'Em dia',
} as const;

const NETWORK_LABEL: Record<WalletNetwork, string> = {
  public: 'Rede principal',
  testnet: 'Rede de testes',
};

/** A resposta nunca repete o que foi digitado: a mensagem sai só do status. */
function addErrorMessage(status: number | undefined): string {
  if (status === 400) return 'Endereço ou apelido inválido. Use um endereço público, que começa com G ou M.';
  if (status === 404) return 'Conta não encontrada nesta rede.';
  if (status === 409) return 'Esta carteira já está no grupo.';
  return 'Não foi possível consultar a rede agora. Tente de novo em instantes.';
}

export function WalletsSection({
  getToken,
  getIdentityToken,
  onChanged,
  onToast,
}: {
  getToken: GetToken;
  getIdentityToken?: () => Promise<string | null>;
  onChanged?: () => void;
  onToast: (message: string) => void;
}) {
  const api = () => createHouseholdApi(getToken, {
    getIdentityToken,
    timeoutMs: WALLET_REQUEST_TIMEOUT_MS,
  });
  const [wallets, setWallets] = useState<HouseholdWalletView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [network, setNetwork] = useState<WalletNetwork>('public');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api().listWallets();
        if (!cancelled) setWallets(rows);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Lê uma vez por abertura da aba; o token só é usado na hora do pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    if (saving) return;
    if (!address.trim() || !label.trim()) {
      setError('Informe o endereço e o apelido.');
      return;
    }
    setSaving(true);
    try {
      const created = await api().addWallet({ address: address.trim(), label: label.trim(), network });
      setWallets((rows) => [...(rows ?? []), created]);
      setAddress('');
      setLabel('');
      setError('');
      onToast('Carteira adicionada');
      onChanged?.();
    } catch (failure) {
      setError(addErrorMessage((failure as { status?: number }).status));
    } finally {
      setSaving(false);
    }
  }

  async function remove(wallet: HouseholdWalletView) {
    try {
      await api().removeWallet(wallet.id);
      setWallets((rows) => (rows ?? []).filter((row) => row.id !== wallet.id));
      onToast('Carteira removida');
      onChanged?.();
    } catch {
      onToast('Não foi possível remover a carteira');
    }
  }

  return (
    <div data-screen-label="Carteiras">
      <div className="conta-stack">
        <div className="conta-copy">
          <h2>Adicionar carteira Stellar</h2>
          <p>Só leitura, nunca pedimos sua chave secreta. Cole apenas o endereço público.</p>
        </div>
        <div className="conta-field">
          <input
            type="text"
            aria-label="Endereço da carteira"
            placeholder="G... ou M..."
            autoComplete="off"
            spellCheck={false}
            value={address}
            onChange={(event) => { setAddress(event.target.value); setError(''); }}
          />
        </div>
        <div className="conta-field">
          <input
            type="text"
            aria-label="Apelido da carteira"
            placeholder="Apelido"
            maxLength={40}
            value={label}
            onChange={(event) => { setLabel(event.target.value); setError(''); }}
          />
          <select
            aria-label="Rede da carteira"
            className="conta-select"
            value={network}
            onChange={(event) => setNetwork(event.target.value as WalletNetwork)}
          >
            {(Object.entries(NETWORK_LABEL) as [WalletNetwork, string][]).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <button type="button" className="conta-save" disabled={saving} onClick={() => void add()}>
            Adicionar
          </button>
        </div>
        {error && <p className="conta-err" role="alert">{error}</p>}
      </div>
      <div className="conta-subhead">
        <strong>Carteiras do grupo</strong>
        <span className="conta-count">{wallets ? wallets.length : '…'}</span>
      </div>
      {failed && <p className="conta-err">Não foi possível carregar as carteiras.</p>}
      {wallets?.length === 0 && <p className="conta-wait">Nenhuma carteira ainda.</p>}
      {wallets?.map((wallet) => (
        <div className="conta-person" key={wallet.id}>
          <span>
            <strong>{wallet.label}</strong>
            <em>{wallet.maskedAddress}</em>
          </span>
          <span className="conta-role">{NETWORK_LABEL[wallet.network]} · {STATUS_LABEL[wallet.syncStatus]}</span>
          {wallet.canManage && (
            <button type="button" className="conta-x" aria-label={`Remover ${wallet.label}`} onClick={() => void remove(wallet)}>×</button>
          )}
        </div>
      ))}
    </div>
  );
}
