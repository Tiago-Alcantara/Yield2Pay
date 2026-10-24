import type { CryptoAction, CryptoFamiliarity, ImportMode, OnboardingGoal } from './onboarding';

export type ExpenseCategory =
  | 'housing' | 'health' | 'education' | 'subscriptions'
  | 'groceries' | 'restaurant' | 'transport' | 'shopping';

export type HouseholdSize = 'solo' | 'two' | 'three_to_four' | 'five_or_more';
export type GoalMonths = 6 | 12 | 24 | 60;
export type CryptoExperience = 'beginner' | 'fund' | 'declined';
export type HouseholdRole = 'owner' | 'member';

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

export interface AccountView {
  displayName: string | null;
  fullName: string | null;
  email: string | null;
  initials: string;
  accountType: 'family';
  household: null | {
    id: string;
    name: string;
    role: HouseholdRole;
    onboardingCompleted: boolean;
  };
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
  category: ExpenseCategory;
  fixed: boolean;
  amountCents: number;
  addedBy: AddedBy;
}

export interface ExpensePage {
  items: ExpenseView[];
  total: number;
}

export interface StatementImportResult {
  statementId: string;
  imported: number;
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
