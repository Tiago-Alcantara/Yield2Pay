export type ExpenseCategory =
  | 'housing' | 'health' | 'education' | 'subscriptions'
  | 'groceries' | 'restaurant' | 'transport' | 'shopping';

export type HouseholdSize = 'solo' | 'two' | 'three_to_four' | 'five_or_more';
export type GoalMonths = 6 | 12 | 24 | 60;
export type CryptoExperience = 'beginner' | 'fund' | 'declined';
export type HouseholdRole = 'owner' | 'member';

export interface AddedBy { displayName: string; initials: string; }

export interface AccountView {
  displayName: string | null;
  fullName: string | null;
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
}

export interface UpsertHouseholdProfile {
  householdSize: HouseholdSize;
  monthlyIncomeCents: number;
  reserveCents: number;
  priorities: string[];
  goalMonths: GoalMonths;
  cryptoExperience: CryptoExperience;
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

export interface StatementImportResult {
  statementId: string;
  imported: number;
  skipped: number;
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

export interface LessonView { id: string; title: string; durationMinutes: number; }
export interface LessonProgressView { lessonId: string; completed: boolean; }
