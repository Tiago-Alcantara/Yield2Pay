import type { OnboardingSwitches } from '@yield2pay/shared';
import { onboardingLevel, unlocks } from '@yield2pay/shared';
import {
  LEVEL_COPY,
  importPhrase,
  spokenName,
  trailCopy,
  type OnboardingDraft,
} from './onboarding-model';

const LOCKED = {
  carteira: 'Libera quando você já tiver comprado cripto.',
  stable: 'Libera para quem usa stablecoin ou recebe rendimento.',
  propria: 'Libera para quem guarda cripto em carteira própria.',
};

export function OnboardingResult({
  draft,
  switches,
  saving,
  error,
  onSwitch,
  onRedo,
  onFinish,
}: {
  draft: OnboardingDraft;
  switches: OnboardingSwitches;
  saving: boolean;
  error: string;
  onSwitch: (key: keyof OnboardingSwitches) => void;
  onRedo: () => void;
  onFinish: () => void;
}) {
  const level = onboardingLevel(draft.goals, draft.familiarity, draft.actions);
  const copy = LEVEL_COPY[level];
  const open = unlocks(draft.familiarity, draft.actions);
  const name = spokenName(draft.fullName, draft.nick);
  const cryptoRows = [
    { key: 'carteira' as const, title: 'Cripto no painel', description: 'O saldo das suas moedas ao lado dos gastos, atualizado.', open: open.carteira },
    { key: 'stable' as const, title: 'Reserva em dólar digital', description: 'Stablecoins entram na sua reserva e no cálculo de liberdade.', open: open.stable },
    { key: 'propria' as const, title: 'Carteira própria', description: 'Acompanhe um endereço público, só leitura. Nunca pedimos suas chaves.', open: open.propria },
  ];
  const cryptoOpen = 1 + cryptoRows.filter((row) => row.open).length;

  return (
    <section className="y2p-onb-list" data-screen-label="06 Resultado">
      <div>
        <div className="y2p-onb-kicker">Tudo pronto</div>
        <h1 className="y2p-onb-title">{name ? `Seu painel está montado, ${name}.` : 'Seu painel está montado.'}</h1>
        <p className="y2p-onb-sub">Ligamos o que faz sentido para o que você contou. Dá para mudar tudo depois em Configurações.</p>
      </div>

      <div className="y2p-onb-card">
        <div className="y2p-onb-kicker">Seu perfil cripto</div>
        <div className="y2p-onb-level">{copy.name}</div>
        <p className="y2p-onb-sub">{copy.description}</p>
        <div className="y2p-onb-level-num" style={{ marginTop: 14 }}>Nível {copy.number}/4</div>
      </div>

      <section className="y2p-onb-group">
        <div className="y2p-onb-group-head">
          <span>Essenciais</span>
          <span>3 de 3</span>
        </div>
        <div className="y2p-onb-row">
          <div>
            <strong>Painel de gastos</strong>
            <p>Seus gastos por categoria, mês a mês. Importação principal: {importPhrase(draft.importMode)}.</p>
          </div>
          <span className="y2p-onb-status">Sempre ativo</span>
        </div>
        <SwitchRow
          title="Liberdade financeira"
          description="Quantos meses a reserva sustenta a casa e o caminho até a meta."
          on={switches.showFreedom}
          onClick={() => onSwitch('showFreedom')}
        />
        <SwitchRow
          title="Grupo familiar"
          description="Convide quem divide as contas com você."
          on={switches.showFamily}
          onClick={() => onSwitch('showFamily')}
        />
      </section>

      <section className="y2p-onb-group">
        <div className="y2p-onb-group-head">
          <span>Cripto</span>
          <span>{cryptoOpen} de 4</span>
        </div>
        <SwitchRow
          title="Aprender cripto"
          description={trailCopy(level)}
          on={switches.learnCrypto}
          onClick={() => onSwitch('learnCrypto')}
        />
        {cryptoRows.map((row) => (
          <div className="y2p-onb-row" key={row.key}>
            <div>
              <strong>{row.title}</strong>
              <p>{row.description}</p>
            </div>
            <span className={row.open ? 'y2p-onb-status' : 'y2p-onb-status is-locked'}>
              {row.open ? 'Liberado' : LOCKED[row.key]}
            </span>
          </div>
        ))}
      </section>

      {error && <p className="y2p-onb-error" role="alert">{error}</p>}

      <div className="y2p-onb-actions">
        <button type="button" className="y2p-onb-redo" onClick={onRedo} disabled={saving}>Refazer perguntas</button>
        <button type="button" className="y2p-onb-next" onClick={onFinish} disabled={saving}>Ir para o painel</button>
      </div>
    </section>
  );
}

function SwitchRow({
  title,
  description,
  on,
  onClick,
}: {
  title: string;
  description: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <div className="y2p-onb-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button type="button" className={on ? 'y2p-onb-switch is-on' : 'y2p-onb-switch'} role="switch" aria-checked={on} aria-label={title} onClick={onClick}>
        <i />
      </button>
    </div>
  );
}
