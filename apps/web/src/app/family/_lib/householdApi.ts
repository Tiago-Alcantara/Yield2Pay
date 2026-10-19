import type {
  AccountView,
  ExpenseCategory,
  ExpenseView,
  HouseholdProfile,
  HouseholdRole,
  HouseholdSummary,
  LessonProgressView,
  LessonView,
  StatementImportResult,
  UpsertHouseholdProfile,
} from '@yield2pay/shared';

type GetToken = () => Promise<string | null>;

export interface HouseholdCurrent {
  id: string;
  name: string;
  role: HouseholdRole;
  onboardingCompleted: boolean;
  pendingInvites: { id: string; email: string }[];
}

function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export function createHouseholdApi(getToken: GetToken) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token != null && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      throw new Error(`${init.method ?? 'GET'} ${path} failed`);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  return {
    getAccount: () => request<AccountView>('/account'),
    createHousehold: (name: string) =>
      request<{ id: string; name: string; role: 'owner' }>('/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }),
    getCurrentHousehold: () => request<HouseholdCurrent>('/households/current'),
    inviteMember: (email: string) =>
      request<unknown>('/households/current/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }),
    getProfile: () => request<HouseholdProfile>('/household/profile'),
    putProfile: (body: UpsertHouseholdProfile) =>
      request<void>('/household/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    patchProfile: (body: Partial<UpsertHouseholdProfile>) =>
      request<void>('/household/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    skipProfile: () => request<void>('/household/profile/skip', { method: 'POST' }),
    getExpenses: (opts?: { month?: string; category?: ExpenseCategory }) =>
      request<ExpenseView[]>(
        `/expenses${queryString({ month: opts?.month, category: opts?.category })}`,
      ),
    getExpenseMonths: () => request<string[]>('/expenses/months'),
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
        throw new Error('POST /statements failed');
      }
      return (await response.json()) as StatementImportResult;
    },
    getLessons: (track: 'beginner' | 'fund') =>
      request<LessonView[]>(`/lessons${queryString({ track })}`),
    getLessonProgress: () => request<LessonProgressView[]>('/lesson-progress'),
    putLessonProgress: (id: string, completed: boolean) =>
      request<void>(`/lesson-progress/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      }),
    deleteLessonProgress: () => request<void>('/lesson-progress', { method: 'DELETE' }),
  };
}
