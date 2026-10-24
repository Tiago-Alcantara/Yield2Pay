'use client';

import { useState } from 'react';
import type { CompleteOnboarding, OnboardingSwitches } from '@yield2pay/shared';
import { defaultSwitches, onboardingLevel, unlocks } from '@yield2pay/shared';
import { FamilyBrand } from '../_components/FamilyUI';
import { OnboardingResult } from './OnboardingResult';
import {
  EMPTY_DRAFT,
  EXPERIENCE_CHOICES,
  FAMILIARITY_CHOICES,
  GOAL_CHOICES,
  IMPORT_CHOICES,
  canContinue,
  completionBody,
  nickHint,
  previewChips,
  questionSteps,
  spokenName,
  toggleItem,
  type Choice,
  type OnboardingDraft,
} from './onboarding-model';
import type { CryptoAction, CryptoFamiliarity, ImportMode, OnboardingGoal, QuestionStep } from '@yield2pay/shared';
import './onboarding.css';

type Screen = QuestionStep | 'result';

export function Onboarding({
  onSave,
  onFinish,
  initial,
}: {
  onSave: (body: CompleteOnboarding) => Promise<void>;
  onFinish: () => void;
  initial?: { draft: OnboardingDraft; switches: OnboardingSwitches };
}) {
  const [screen, setScreen] = useState<Screen>('name');
  const [draft, setDraft] = useState<OnboardingDraft>(initial?.draft ?? EMPTY_DRAFT);
  const [switchOverride, setSwitchOverride] = useState<OnboardingSwitches | null>(initial?.switches ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const steps = questionSteps(draft.familiarity);
  const asking = screen !== 'result';
  const index = asking ? steps.indexOf(screen) : -1;
  const ready = asking && canContinue(screen, draft);
  const switches = switchOverride ?? defaultSwitches(draft.goals, draft.familiarity);
  const name = spokenName(draft.fullName, draft.nick);

  function patch(next: Partial<OnboardingDraft>, resetSwitches = false) {
    setDraft((current) => ({ ...current, ...next }));
    if (resetSwitches) setSwitchOverride(null);
  }

  function goNext() {
    if (!asking || !ready) return;
    const following = steps[index + 1];
    setScreen(following ?? 'result');
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave(completionBody(draft, switches));
      onFinish();
    } catch {
      setError('Não foi possível salvar. Tente de novo.');
      setSaving(false);
    }
  }

  return (
    <div className="y2p-onb" role="dialog" aria-modal="true" aria-label="Boas-vindas">
      <header className="y2p-onb-header">
        <FamilyBrand size={18} />
        {asking && (
          <>
            <div className="y2p-onb-progress">
              <div className="y2p-onb-segs" aria-hidden="true">
                {steps.map((step, stepIndex) => (
                  <span key={step} className={stepIndex <= index ? 'is-on' : ''} />
                ))}
              </div>
              <div className="y2p-onb-step">Pergunta {index + 1} de {steps.length}</div>
            </div>
            <button type="button" className="y2p-onb-skip" onClick={() => setScreen('result')}>Pular por agora</button>
          </>
        )}
      </header>

      <main className="y2p-onb-main">
        {screen === 'name' && (
          <section data-screen-label="01 Perfil">
            <div className="y2p-onb-kicker">Boas-vindas</div>
            <h1 className="y2p-onb-title">Primeiro, como você se chama?</h1>
            <p className="y2p-onb-sub">O nome aparece para o seu grupo. O apelido é como a gente fala com você.</p>
            <div className="y2p-onb-fields" style={{ marginTop: 28 }}>
              <label className="y2p-onb-field">
                <span className="y2p-onb-label">Nome</span>
                <input
                  type="text"
                  maxLength={32}
                  autoComplete="given-name"
                  placeholder="Seu nome"
                  value={draft.fullName}
                  onChange={(event) => patch({ fullName: event.target.value })}
                  onKeyDown={(event) => { if (event.key === 'Enter') goNext(); }}
                />
              </label>
              <label className="y2p-onb-field">
                <span className="y2p-onb-label">Como prefere ser chamado</span>
                <input
                  type="text"
                  maxLength={24}
                  autoComplete="nickname"
                  placeholder={draft.fullName.trim().split(/\s+/)[0] || 'Apelido ou primeiro nome'}
                  value={draft.nick}
                  onChange={(event) => patch({ nick: event.target.value })}
                  onKeyDown={(event) => { if (event.key === 'Enter') goNext(); }}
                />
              </label>
              <p className="y2p-onb-hint">{nickHint(draft.fullName, draft.nick)}</p>
            </div>
          </section>
        )}

        {screen === 'goals' && (
          <section data-screen-label="02 Objetivo">
            {name && <p className="y2p-onb-hello">Olá, {name}</p>}
            <h1 className="y2p-onb-title">O que você quer resolver primeiro?</h1>
            <p className="y2p-onb-sub">Marque quantos quiser. Isso define o que aparece no seu painel.</p>
            <div className="y2p-onb-list" style={{ marginTop: 28 }}>
              {GOAL_CHOICES.map((choice) => (
                <ChoiceButton
                  key={choice.id}
                  choice={choice}
                  multiple
                  selected={draft.goals.includes(choice.id as OnboardingGoal)}
                  onClick={() => patch({ goals: toggleItem(draft.goals, choice.id as OnboardingGoal) }, true)}
                />
              ))}
            </div>
          </section>
        )}

        {screen === 'import' && (
          <section data-screen-label="03 Importação">
            <h1 className="y2p-onb-title">Como prefere trazer seus gastos?</h1>
            <p className="y2p-onb-sub">Essa vira a forma principal no painel. As outras continuam disponíveis.</p>
            <div className="y2p-onb-list" role="radiogroup" aria-label="Forma de importação" style={{ marginTop: 28 }}>
              {IMPORT_CHOICES.map((choice) => (
                <ChoiceButton
                  key={choice.id}
                  choice={choice}
                  selected={draft.importMode === choice.id}
                  onClick={() => patch({ importMode: choice.id as ImportMode })}
                />
              ))}
            </div>
          </section>
        )}

        {screen === 'familiarity' && (
          <section data-screen-label="04 Cripto">
            <div className="y2p-onb-kicker">Sobre cripto</div>
            <h1 className="y2p-onb-title">Quanto você já sabe de cripto?</h1>
            <p className="y2p-onb-sub">Sem resposta certa. Usamos isso para não mostrar nem de menos, nem de mais.</p>
            <div className="y2p-onb-list" role="radiogroup" aria-label="Familiaridade com cripto" style={{ marginTop: 28 }}>
              {FAMILIARITY_CHOICES.map((choice) => (
                <ChoiceButton
                  key={choice.id}
                  choice={choice}
                  selected={draft.familiarity === choice.id}
                  onClick={() => patch({ familiarity: choice.id as CryptoFamiliarity, actions: [] }, true)}
                />
              ))}
            </div>
            {draft.familiarity && <Preview draft={{ ...draft, familiarity: draft.familiarity }} />}
          </section>
        )}

        {screen === 'experience' && (
          <section data-screen-label="05 Experiência">
            <div className="y2p-onb-kicker">Sua experiência</div>
            <h1 className="y2p-onb-title">O que você já fez com cripto?</h1>
            <p className="y2p-onb-sub">Marque o que se aplica. Algumas respostas liberam ferramentas novas.</p>
            <div className="y2p-onb-list" style={{ marginTop: 28 }}>
              {EXPERIENCE_CHOICES.map((choice) => (
                <ChoiceButton
                  key={choice.id}
                  choice={choice}
                  multiple
                  selected={draft.actions.includes(choice.id as CryptoAction)}
                  onClick={() => patch({ actions: toggleItem(draft.actions, choice.id as CryptoAction) }, true)}
                />
              ))}
            </div>
            <Preview draft={draft} />
          </section>
        )}

        {screen === 'result' && (
          <OnboardingResult
            draft={draft}
            switches={switches}
            saving={saving}
            error={error}
            onSwitch={(key) => setSwitchOverride({ ...switches, [key]: !switches[key] })}
            onRedo={() => { setError(''); setScreen('goals'); }}
            onFinish={() => void finish()}
          />
        )}

        {asking && (
          <div className="y2p-onb-nav">
            {index > 0 ? (
              <button type="button" className="y2p-onb-back" onClick={() => setScreen(steps[index - 1])}>Voltar</button>
            ) : <span />}
            <button type="button" className="y2p-onb-next" disabled={!ready} onClick={goNext}>
              {index === steps.length - 1 ? 'Ver meu painel' : 'Continuar'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function ChoiceButton({
  choice,
  selected,
  multiple = false,
  onClick,
}: {
  choice: Choice;
  selected: boolean;
  multiple?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={selected ? 'y2p-onb-choice is-on' : 'y2p-onb-choice'}
      aria-pressed={multiple ? selected : undefined}
      role={multiple ? undefined : 'radio'}
      aria-checked={multiple ? undefined : selected}
      onClick={onClick}
    >
      {!multiple && (
        <span className={selected ? 'y2p-onb-mark is-radio' : 'y2p-onb-mark is-radio'}>{selected && <i />}</span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong>{choice.title}</strong>
        <em>{choice.description}</em>
      </span>
      {choice.tag && <span className="y2p-onb-choice-tag">{choice.tag}</span>}
      {multiple && (
        <span className="y2p-onb-mark is-check">{selected ? '✓' : ''}</span>
      )}
    </button>
  );
}

function Preview({ draft }: { draft: OnboardingDraft }) {
  const level = onboardingLevel(draft.goals, draft.familiarity, draft.actions);
  const chips = previewChips(level, unlocks(draft.familiarity, draft.actions));
  return (
    <div className="y2p-onb-preview" aria-live="polite">
      <span className="y2p-onb-label">{level === 'fora' ? 'O que isso muda' : 'Com essas respostas, você libera'}</span>
      {level === 'fora' ? (
        <p className="y2p-onb-sub" style={{ margin: 0 }}>Cripto fica de fora por enquanto. Dá para ligar depois em Configurações.</p>
      ) : (
        <div className="y2p-onb-chips">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>
      )}
    </div>
  );
}
