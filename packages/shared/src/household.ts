import type { CryptoAction, CryptoFamiliarity, ImportMode, OnboardingGoal } from './onboarding';

export type ExpenseCategory =
  | 'housing' | 'health' | 'education' | 'subscriptions'
  | 'groceries' | 'restaurant' | 'transport' | 'shopping';

/** Gasto ou entrada de dinheiro. A entrada não tem categoria. */
export type ExpenseKind = 'expense' | 'income';
/** De onde a linha veio. 'wallet' é reservado para a carteira. */
export type ExpenseSource = 'manual' | 'statement' | 'wallet';

export type HouseholdSize = 'solo' | 'two' | 'three_to_four' | 'five_or_more';
export type GoalMonths = 6 | 12 | 24 | 60;
export type CryptoExperience = 'beginner' | 'fund' | 'declined';
export type HouseholdRole = 'owner' | 'member';

/** Máximo de grupos por pessoa, contando o individual. */
export const MAX_GROUPS = 5;
/** Grupos alheios que a pessoa pode ter quando companies.guest_group_limit é nulo. */
export const DEFAULT_GUEST_LIMIT = 1;
/** Header com o id do grupo ativo. Sem ele a API usa o grupo padrão da pessoa. */
export const HOUSEHOLD_ID_HEADER = 'X-Household-Id';

export interface AddedBy { displayName: string; initials: string; }

/** Iniciais do nome que a pessoa vê: apelido, senão o nome completo. */
export function accountInitials(
  fullName: string | null | undefined,
  displayName: string | null | undefined,
): string {
  return personInitials(displayName?.trim() || fullName?.trim() || '');
}

export function personInitials(name: string): string {
  const marks = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((word) => firstGrapheme(word).toLocaleUpperCase('pt-BR'))
    .filter(Boolean);
  return marks.join('') || '?';
}

function firstGrapheme(value: string): string {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const first = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)[Symbol.iterator]().next().value;
    return first?.segment ?? '';
  }
  return Array.from(value)[0] ?? '';
}

/** Um grupo da pessoa. personal = o grupo individual dela. */
export interface AccountHouseholdView {
  id: string;
  name: string;
  role: HouseholdRole;
  personal: boolean;
}

export interface ActiveHouseholdView extends AccountHouseholdView {
  onboardingCompleted: boolean;
}

export interface AccountView {
  displayName: string | null;
  fullName: string | null;
  email: string | null;
  initials: string;
  accountType: 'family';
  /** Todos os grupos da pessoa. Vazio só antes de ela criar o primeiro. */
  households: AccountHouseholdView[];
  /** Grupo do header X-Household-Id ou o padrão. Nulo só com households vazio. */
  activeHousehold: ActiveHouseholdView | null;
  /**
   * Mesmo valor de activeHousehold, para o web publicado que ainda lê este campo.
   * @deprecated Use activeHousehold. Sai na F4.
   */
  household: ActiveHouseholdView | null;
}

export interface HouseholdProfile {
  householdSize: HouseholdSize | null;
  monthlyIncomeCents: number | null;
  reserveCents: number | null;
  priorities: string[];
  goalMonths: GoalMonths | null;
  cryptoExperience: CryptoExperience | null;
  onboardingCompleted: boolean;
  goals: OnboardingGoal[];
  importMode: ImportMode | null;
  cryptoFamiliarity: CryptoFamiliarity | null;
  cryptoActions: CryptoAction[];
  showFreedom: boolean;
  showFamily: boolean;
}

export interface UpsertHouseholdProfile {
  householdSize: HouseholdSize;
  monthlyIncomeCents: number;
  reserveCents: number;
  priorities: string[];
  goalMonths: GoalMonths;
  cryptoExperience: CryptoExperience;
}

export interface PatchHouseholdProfile extends Partial<UpsertHouseholdProfile> {
  showFreedom?: boolean;
  showFamily?: boolean;
}

export interface ExpenseView {
  id: string;
  date: string;
  merchant: string;
  kind: ExpenseKind;
  /** Nula só em entrada. */
  category: ExpenseCategory | null;
  fixed: boolean;
  amountCents: number;
  /** A linha aparece na lista, mas fica fora de todos os totais. */
  excludedFromTotals: boolean;
  addedBy: AddedBy;
}

export interface ExpensePage {
  items: ExpenseView[];
  total: number;
  nextCursor?: string | null;
}

export interface StatementImportResult {
  statementId: string;
  imported: number;
  skipped: number;
}

/** Uma linha do extrato antes de gravar. index é a posição dela em kinds, na confirmação. */
export interface StatementPreviewRow {
  index: number;
  date: string;
  merchant: string;
  amountCents: number;
  kind: ExpenseKind;
  /** O FITID já está no grupo: a confirmação pula esta linha. */
  alreadyImported: boolean;
}

export interface StatementPreview {
  filename: string;
  rows: StatementPreviewRow[];
  /** Linhas do arquivo que não deu para ler. */
  skipped: number;
}

export interface StatementView {
  id: string;
  filename: string;
  importedAt: string;
  expenseCount: number;
}

export interface MonthTotal {
  month: string;
  amountCents: number;
}

export interface HouseholdSummary {
  monthTotalCents: number;
  /** Soma das entradas do mês. Não é a renda informada no perfil. */
  incomeCents: number;
  /** Entradas menos gastos do mês. */
  balanceCents: number;
  previousComparableCents: number;
  changePercent: number | null;
  projectedCents: number;
  leftoverCents: number | null;
  byCategory: { category: ExpenseCategory; amountCents: number }[];
  lastSixMonths: { month: string; amountCents: number }[];
  averageCents: number;
  dailyPace: { current: number[]; previous: number[] };
  fixedVsVariable: { month: string; fixedCents: number; variableCents: number }[];
  freedom: null | { months: number; missingCents: number; deadlineMonths: number };
}

export interface HouseholdPersonView {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'member' | 'invited';
  you: boolean;
}

export interface LessonView { id: string; title: string; durationMinutes: number; }
export interface LessonProgressView {
  lessonId: string;
  completed: boolean;
  quizPassed: boolean;
  answers: number[] | null;
}
