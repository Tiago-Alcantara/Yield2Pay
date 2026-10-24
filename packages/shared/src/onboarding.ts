export const ONBOARDING_GOALS = ['gastos', 'reserva', 'familia', 'aprender', 'investir'] as const;
export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number];

export const IMPORT_MODES = ['ofx', 'nfe', 'manual'] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

export const CRYPTO_FAMILIARITY = ['nunca', 'ouvi', 'comprei', 'frequente'] as const;
export type CryptoFamiliarity = (typeof CRYPTO_FAMILIARITY)[number];

export const CRYPTO_ACTIONS = ['corretora', 'transferi', 'stable', 'rendimento', 'autocustodia'] as const;
export type CryptoAction = (typeof CRYPTO_ACTIONS)[number];

export type OnboardingLevel = 'fora' | 'curioso' | 'praticante' | 'avancado';
export type DerivedCryptoExperience = 'beginner' | 'fund' | 'declined';

export interface OnboardingSwitches {
  showFreedom: boolean;
  showFamily: boolean;
  learnCrypto: boolean;
}

export interface OnboardingUnlocks {
  carteira: boolean;
  stable: boolean;
  propria: boolean;
}

export interface CompleteOnboarding {
  fullName: string | null;
  displayName: string | null;
  goals: OnboardingGoal[];
  importMode: ImportMode | null;
  cryptoFamiliarity: CryptoFamiliarity | null;
  cryptoActions: CryptoAction[];
  showFreedom: boolean;
  showFamily: boolean;
  learnCrypto: boolean;
}

export type QuestionStep = 'name' | 'goals' | 'import' | 'familiarity' | 'experience';

const FAMILIARITY_INDEX: Record<CryptoFamiliarity, number> = {
  nunca: 0,
  ouvi: 1,
  comprei: 2,
  frequente: 3,
};

export function familiarityIndex(value: CryptoFamiliarity | null): number {
  if (!value) return -1;
  return FAMILIARITY_INDEX[value];
}

export function isMature(value: CryptoFamiliarity | null): boolean {
  return familiarityIndex(value) >= 2;
}

export function hasCryptoInterest(goals: readonly string[]): boolean {
  return goals.includes('aprender') || goals.includes('investir');
}

export function countedActions(
  familiarity: CryptoFamiliarity | null,
  actions: readonly CryptoAction[],
): CryptoAction[] {
  if (!isMature(familiarity)) return [];
  return actions.filter((item, index) => actions.indexOf(item) === index);
}

export function questionSteps(familiarity: CryptoFamiliarity | null): QuestionStep[] {
  const steps: QuestionStep[] = ['name', 'goals', 'import', 'familiarity'];
  if (isMature(familiarity)) steps.push('experience');
  return steps;
}

export function onboardingLevel(
  goals: readonly OnboardingGoal[],
  familiarity: CryptoFamiliarity | null,
  actions: readonly CryptoAction[],
): OnboardingLevel {
  const index = familiarityIndex(familiarity);
  const counted = countedActions(familiarity, actions);
  if (index <= 0 && !hasCryptoInterest(goals)) return 'fora';
  if (index <= 1) return 'curioso';
  if (index === 3 || counted.includes('rendimento') || counted.includes('autocustodia')) return 'avancado';
  return 'praticante';
}

export function defaultSwitches(
  goals: readonly OnboardingGoal[],
  familiarity: CryptoFamiliarity | null,
): OnboardingSwitches {
  return {
    showFreedom: goals.includes('reserva') || goals.length === 0,
    showFamily: goals.includes('familia'),
    learnCrypto: hasCryptoInterest(goals) || familiarityIndex(familiarity) >= 1,
  };
}

export function cryptoExperienceFor(
  level: OnboardingLevel,
  learnCrypto: boolean,
): DerivedCryptoExperience {
  if (!learnCrypto) return 'declined';
  if (level === 'praticante' || level === 'avancado') return 'fund';
  return 'beginner';
}

export function unlocks(
  familiarity: CryptoFamiliarity | null,
  actions: readonly CryptoAction[],
): OnboardingUnlocks {
  const index = familiarityIndex(familiarity);
  const counted = countedActions(familiarity, actions);
  return {
    carteira: isMature(familiarity),
    stable: index === 3 || counted.includes('stable') || counted.includes('rendimento'),
    propria: counted.includes('autocustodia'),
  };
}
