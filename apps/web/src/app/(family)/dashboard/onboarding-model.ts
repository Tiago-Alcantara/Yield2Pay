import type {
  CompleteOnboarding,
  CryptoAction,
  CryptoFamiliarity,
  ImportMode,
  OnboardingGoal,
  OnboardingLevel,
  OnboardingSwitches,
  QuestionStep,
} from '@yield2pay/shared';
import {
  countedActions,
  cryptoExperienceFor,
  defaultSwitches,
  isMature,
  onboardingLevel,
  questionSteps,
  unlocks,
} from '@yield2pay/shared';

export {
  countedActions,
  cryptoExperienceFor,
  defaultSwitches,
  isMature,
  onboardingLevel,
  questionSteps,
  unlocks,
};
export type { OnboardingLevel, OnboardingSwitches, QuestionStep } from '@yield2pay/shared';

export interface Choice {
  id: string;
  title: string;
  description: string;
  tag?: string;
}

export const GOAL_CHOICES: Choice[] = [
  { id: 'gastos', title: 'Organizar os gastos da casa', description: 'Ver para onde o dinheiro vai, mês a mês.' },
  { id: 'reserva', title: 'Construir uma reserva', description: 'Saber quantos meses a casa se sustenta sem renda.' },
  { id: 'familia', title: 'Dividir com a família', description: 'Um painel só, cada pessoa com seu e-mail.' },
  { id: 'aprender', title: 'Entender cripto', description: 'Aulas curtas, sem jargão, no seu ritmo.' },
  { id: 'investir', title: 'Acompanhar minhas criptos', description: 'Ver suas moedas ao lado dos gastos.' },
];

export const IMPORT_CHOICES: Choice[] = [
  { id: 'ofx', tag: 'Mais completo', title: 'Extrato do banco', description: 'Arquivo OFX, CSV ou PDF com os gastos do mês.' },
  { id: 'nfe', tag: 'Mais detalhado', title: 'Nota fiscal', description: 'Uma compra por vez, pela chave de acesso da nota.' },
  { id: 'manual', tag: 'Mais simples', title: 'Manual', description: 'Você digita cada gasto, do seu jeito.' },
];

export const FAMILIARITY_CHOICES: Choice[] = [
  { id: 'nunca', title: 'Nunca mexi', description: 'Sei pouco ou nada sobre o assunto.' },
  { id: 'ouvi', title: 'Já ouvi falar', description: 'Entendo a ideia, mas nunca comprei.' },
  { id: 'comprei', title: 'Já comprei', description: 'Tenho ou já tive cripto em alguma corretora.' },
  { id: 'frequente', title: 'Uso com frequência', description: 'Compro, transfiro e acompanho com regularidade.' },
];

export const EXPERIENCE_CHOICES: Choice[] = [
  { id: 'corretora', title: 'Comprei em corretora', description: 'Mercado Bitcoin, Binance, Foxbit ou similar.' },
  { id: 'transferi', title: 'Transferi entre carteiras', description: 'Já mandei cripto de um lugar para outro.' },
  { id: 'stable', title: 'Uso dólar digital', description: 'Guardo parte em stablecoin, como USDT ou USDC.' },
  { id: 'rendimento', title: 'Recebo rendimento sobre cripto', description: 'Staking, empréstimo ou produto parecido.' },
  { id: 'autocustodia', title: 'Tenho carteira própria', description: 'Guardo as chaves fora da corretora.' },
];

export const LEVEL_COPY: Record<OnboardingLevel, { number: number; name: string; description: string }> = {
  fora: {
    number: 1,
    name: 'Foco no essencial',
    description: 'Começamos pelos gastos e pela reserva. Cripto fica guardado até você querer.',
  },
  curioso: {
    number: 2,
    name: 'Começando em cripto',
    description: 'Você recebe a trilha do zero: aulas curtas, uma ideia por vez.',
  },
  praticante: {
    number: 3,
    name: 'Já pratica',
    description: 'A trilha começa de onde você já está. Cripto no painel fica para uma próxima versão.',
  },
  avancado: {
    number: 4,
    name: 'Avançado',
    description: 'A trilha de quem já conhece fica ligada. Reserva em dólar digital e carteira própria ficam para uma próxima versão.',
  },
};

const IMPORT_PHRASE: Record<ImportMode, string> = {
  ofx: 'extrato do banco',
  nfe: 'nota fiscal',
  manual: 'manual',
};

export interface OnboardingDraft {
  fullName: string;
  nick: string;
  goals: OnboardingGoal[];
  importMode: ImportMode | null;
  familiarity: CryptoFamiliarity | null;
  actions: CryptoAction[];
}

export const EMPTY_DRAFT: OnboardingDraft = {
  fullName: '',
  nick: '',
  goals: [],
  importMode: null,
  familiarity: null,
  actions: [],
};

export function spokenName(fullName: string, nick: string): string {
  const nickname = nick.trim().slice(0, 24);
  if (nickname) return nickname;
  return fullName.trim().split(/\s+/)[0]?.slice(0, 32) ?? '';
}

export function nickHint(fullName: string, nick: string): string {
  const nickname = nick.trim();
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  if (nickname) return `Vamos te chamar de ${nickname}.`;
  if (first) return `Se deixar em branco, usamos ${first}.`;
  return 'Opcional.';
}

export function canContinue(step: QuestionStep, draft: OnboardingDraft): boolean {
  if (step === 'name') return draft.fullName.trim().length >= 2;
  if (step === 'goals') return draft.goals.length > 0;
  if (step === 'import') return draft.importMode != null;
  if (step === 'familiarity') return draft.familiarity != null;
  return true;
}

export function importPhrase(mode: ImportMode | null): string {
  return IMPORT_PHRASE[mode ?? 'ofx'];
}

export function trailCopy(level: OnboardingLevel): string {
  if (level === 'praticante' || level === 'avancado') {
    return 'Trilha para quem já conhece: carteiras, taxas e riscos.';
  }
  return 'Trilha do zero: o que é, para que serve e como não cair em golpe.';
}

export function previewChips(
  level: OnboardingLevel,
  open: { carteira: boolean; stable: boolean; propria: boolean },
): string[] {
  if (level === 'fora') return [];
  const chips = [level === 'praticante' || level === 'avancado' ? 'Trilha: já conheço' : 'Trilha do zero'];
  if (open.carteira) chips.push('Cripto no painel');
  if (open.stable) chips.push('Reserva em dólar digital');
  if (open.propria) chips.push('Carteira própria');
  return chips;
}

export function completionBody(draft: OnboardingDraft, switches: OnboardingSwitches): CompleteOnboarding {
  const fullName = draft.fullName.trim().slice(0, 32);
  const displayName = spokenName(draft.fullName, draft.nick);
  const actions = isMature(draft.familiarity) ? countedActions(draft.familiarity, draft.actions) : [];
  return {
    fullName: fullName || null,
    displayName: displayName || null,
    goals: draft.goals,
    importMode: draft.importMode,
    cryptoFamiliarity: draft.familiarity,
    cryptoActions: actions,
    showFreedom: switches.showFreedom,
    showFamily: switches.showFamily,
    learnCrypto: switches.learnCrypto,
  };
}

export function draftFromSaved(input: {
  fullName: string | null;
  displayName: string | null;
  goals?: readonly OnboardingGoal[] | null;
  importMode?: ImportMode | null;
  familiarity?: CryptoFamiliarity | null;
  actions?: readonly CryptoAction[] | null;
}): OnboardingDraft {
  const fullName = input.fullName ?? '';
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  const display = (input.displayName ?? '').trim();
  return {
    fullName,
    nick: display && display !== first ? display : '',
    goals: [...(input.goals ?? [])],
    importMode: input.importMode ?? null,
    familiarity: input.familiarity ?? null,
    actions: [...(input.actions ?? [])],
  };
}

export function toggleItem<T extends string>(items: readonly T[], id: T): T[] {
  return items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
}
