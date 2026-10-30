import type {
  AccountView,
  ExpenseCategory,
  ExpensePage,
  ExpenseView,
  HouseholdPersonView,
  CompleteOnboarding,
  HouseholdProfile,
  HouseholdRole,
  HouseholdSummary,
  LessonProgressView,
  LessonView,
  PatchHouseholdProfile,
  MonthTotal,
  StatementImportResult,
  StatementView,
  UpsertHouseholdProfile,
} from '@yield2pay/shared';

type GetToken = () => Promise<string | null>;

/** A tela mostra o erro assim que este prazo estoura, sem uma segunda espera. */
export const HOUSEHOLD_REQUEST_TIMEOUT_MS = 8_000;

/** Um mês inteiro volta numa página só. A API aceita este teto. */
export const MONTH_EXPENSE_LIMIT = '5000';

export type HouseholdRequestError = Error & { status?: number; timeout?: boolean };

export interface HouseholdCurrent {
  id: string;
  name: string;
  role: HouseholdRole;
  onboardingCompleted: boolean;
  pendingInvites: { id: string; email: string }[];
}

function isRequestTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export function createHouseholdApi(getToken: GetToken, options?: { timeoutMs?: number }) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  const timeoutMs = options?.timeoutMs ?? HOUSEHOLD_REQUEST_TIMEOUT_MS;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token != null && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, { ...init, headers, signal });
    } catch (error) {
      if (isRequestTimeout(error)) {
        const timeoutError = new Error(`${init.method ?? 'GET'} ${path} timed out`) as HouseholdRequestError;
        timeoutError.timeout = true;
        throw timeoutError;
      }
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`${init.method ?? 'GET'} ${path} failed`) as HouseholdRequestError;
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  return {
    getAccount: () => request<AccountView>('/account'),
    patchAccount: (displayName: string) =>
      request<AccountView>('/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      }),
    clearMyData: (mode: 'expenses' | 'all') =>
      request<void>('/account/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      }),
    createHousehold: (name: string) =>
      request<{ id: string; name: string; role: 'owner' }>('/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }),
    getCurrentHousehold: () => request<HouseholdCurrent>('/households/current'),
    renameHousehold: (name: string) =>
      request<void>('/households/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }),
    getPeople: () => request<HouseholdPersonView[]>('/households/current/people'),
    leaveHousehold: () => request<void>('/households/current/leave', { method: 'POST' }),
    removeMember: (id: string) =>
      request<void>(`/households/current/members/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    inviteMember: (email: string) =>
      request<unknown>('/households/current/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }),
    revokeInvite: (id: string) =>
      request<void>(`/households/invites/${encodeURIComponent(id)}/revoke`, { method: 'POST' }),
    getProfile: () => request<HouseholdProfile>('/household/profile'),
    putProfile: (body: UpsertHouseholdProfile) =>
      request<void>('/household/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    patchProfile: (body: PatchHouseholdProfile) =>
      request<void>('/household/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    completeOnboarding: (body: CompleteOnboarding) =>
      request<AccountView>('/household/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    skipProfile: () => request<void>('/household/profile/skip', { method: 'POST' }),
    getExpenses: async (opts?: { month?: string; from?: string; to?: string; category?: ExpenseCategory }) => {
      const page = await request<ExpensePage>(
        `/expenses${queryString({
          month: opts?.from ? undefined : opts?.month,
          from: opts?.from,
          to: opts?.to,
          category: opts?.category,
          limit: MONTH_EXPENSE_LIMIT,
        })}`,
      );
      return page.items;
    },
    getExpenseMonths: async () => {
      const rows = await request<Array<string | MonthTotal>>('/expenses/months');
      return rows.map((row) =>
        typeof row === 'string' ? { month: row, amountCents: 0 } : { month: row.month, amountCents: row.amountCents ?? 0 },
      );
    },
    createExpense: (body: { merchant: string; amountCents: number; spentOn: string; category: ExpenseCategory }) =>
      request<ExpenseView>('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    patchExpense: (id: string, body: { category?: ExpenseCategory; fixed?: boolean }) =>
      request<ExpenseView>(`/expenses/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    deleteExpense: (id: string) =>
      request<void>(`/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    deleteStatement: (id: string) =>
      request<void>(`/statements/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    listStatements: () => request<StatementView[]>('/statements'),
    getHouseholdSummary: (opts?: { month?: string; category?: ExpenseCategory }) =>
      request<HouseholdSummary>(
        `/household/summary${queryString({ month: opts?.month, category: opts?.category })}`,
      ),
    importStatement: async (file: File) => {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token != null) headers.Authorization = `Bearer ${token}`;
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`${baseUrl}/statements`, { method: 'POST', headers, body });
      if (!response.ok) {
        const error = new Error('POST /statements failed') as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      return (await response.json()) as StatementImportResult;
    },
    getLessons: (track: 'beginner' | 'fund') =>
      request<LessonView[]>(`/lessons${queryString({ track })}`),
    getLessonProgress: () => request<LessonProgressView[]>('/lesson-progress'),
    putLessonProgress: (id: string, completed: boolean, answers?: number[]) =>
      request<void>(`/lesson-progress/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed, answers }),
      }),
    deleteLessonProgress: () => request<void>('/lesson-progress', { method: 'DELETE' }),
  };
}
