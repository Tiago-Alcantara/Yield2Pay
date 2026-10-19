# Family Expense Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the family expense panel from the API: one household group per person, shared expenses with who added each row, statement import, month summary, and lesson progress, without creating a Stellar wallet.

**Architecture:** A `Company` row remains the logged-in person. A `Household` they create or join owns the profile, statements, and expenses. Services are plain classes tested with a fake Prisma. Controllers only read `req.companyId` from the existing `AuthGuard` and delegate. The web module calls these routes and does not call `ensureWallet`.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, Vitest, Next.js 16, `@yield2pay/shared`.

## Global Constraints

- Money is integer centavos of BRL. `R$ 12,50` is `1250`.
- "Today" is the calendar date of the API server in `America/Sao_Paulo`.
- Each person belongs to at most one household.
- The creator invites by email. Every expense records who added it.
- Category values: `housing`, `health`, `education`, `subscriptions`, `groceries`, `restaurant`, `transport`, `shopping`.
- `householdSize`: `solo`, `two`, `three_to_four`, `five_or_more`.
- `goalMonths`: `6`, `12`, `24`, `60`.
- `cryptoExperience`: `beginner`, `fund`, `declined`.
- `accountType` is always `"family"`.
- Missing or invalid bearer token is `401` (existing `AuthGuard`).
- A member who invites or revokes gets `403`. A second group or a bad accept gets `409`. An expense outside the group gets `404`.
- Expense pages require a Privy session and do not call `ensureWallet`.
- Lesson progress is per person. Household data is per group.

---

## File structure

- `packages/shared/src/household.ts` — request and response types. Re-exported from `packages/shared/src/index.ts`.
- `apps/api/prisma/schema.prisma` — `PersonName`, `Household`, `HouseholdMember`, `HouseholdInvite`, `Statement`, `Expense`, `LessonProgress`.
- `apps/api/src/household/household.service.ts` — group, invites, profile, account.
- `apps/api/src/household/household.controller.ts` — `/account`, `/households`, `/household/profile`.
- `apps/api/src/expenses/classify.ts` — keyword category and the 5 percent fixed rule.
- `apps/api/src/expenses/parse-amount.ts` — CSV and OFX amount strings to centavos.
- `apps/api/src/statements/parse-csv.ts`, `parse-ofx.ts`, `parse-pdf.ts` — file text to rows.
- `apps/api/src/statements/statements.service.ts` — store rows on the caller's household.
- `apps/api/src/expenses/expenses.service.ts` — list, months, patch.
- `apps/api/src/summary/summary.service.ts` — panel math.
- `apps/api/src/lessons/lesson-catalog.ts` — four lessons per track.
- `apps/api/src/lessons/lessons.service.ts` — progress.
- `apps/web/src/app/family/_lib/householdApi.ts` — fetch helpers.
- `apps/web/src/app/family/_components/FamilySessionGate.tsx` — login gate without a wallet.

Each `*.module.ts` follows `BillsModule`: import `AuthModule`, provide the service, register the controller. `AppModule` imports the new modules.

---

### Task 1: Shared household types

**Files:**
- Create: `packages/shared/src/household.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/household.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: the types below, re-exported from `@yield2pay/shared`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import type { ExpenseView, AccountView } from './household';

describe('household types', () => {
  it('accepts an expense row with who added it', () => {
    const row: ExpenseView = {
      id: 'e1',
      date: '2026-10-12',
      merchant: 'Mercado',
      category: 'groceries',
      fixed: false,
      amountCents: 1250,
      addedBy: { displayName: 'Ana', initials: 'A' },
    };
    const account: AccountView = {
      displayName: 'Ana',
      fullName: 'Ana Lima',
      initials: 'AL',
      accountType: 'family',
      household: null,
    };
    expect(row.amountCents).toBe(1250);
    expect(account.accountType).toBe('family');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @yield2pay/shared exec vitest run src/household.test.ts`

Expected: FAIL because `./household` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/household.ts` with these exact aliases and interfaces:

```ts
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
```

Add `export * from './household';` at the end of `packages/shared/src/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @yield2pay/shared exec vitest run src/household.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/household.ts packages/shared/src/household.test.ts packages/shared/src/index.ts
git commit -m "feat: add shared types for household expenses"
```

---

### Task 2: Prisma models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261014210000_household_expenses/migration.sql`

**Interfaces:**
- Consumes: nothing from Task 1 (the database uses the same names)
- Produces: models `PersonName`, `Household`, `HouseholdMember`, `HouseholdInvite`, `Statement`, `Expense`, `LessonProgress`

- [ ] **Step 1: Add the models to `schema.prisma`**

Add `households Household[]` on `Company` only if a relation is required. Prefer relations from the new models to `Company` so `Company` gains:

```
personName         PersonName?
ownedHousehold     Household?  @relation("HouseholdOwner")
householdMembership HouseholdMember?
```

Then the models:

```
model PersonName {
  companyId   String @id @map("company_id")
  displayName String? @map("display_name")
  fullName    String? @map("full_name")
  email       String?
  company     Company @relation(fields: [companyId], references: [id])
  @@map("person_names")
}

model Household {
  id                   String   @id @default(cuid())
  name                 String
  ownerCompanyId       String   @unique @map("owner_company_id")
  householdSize        String?  @map("household_size")
  monthlyIncomeCents   Int?     @map("monthly_income_cents")
  reserveCents         Int?     @map("reserve_cents")
  priorities           String[]
  goalMonths           Int?     @map("goal_months")
  cryptoExperience     String?  @map("crypto_experience")
  onboardingCompleted  Boolean  @default(false) @map("onboarding_completed")
  owner                Company  @relation("HouseholdOwner", fields: [ownerCompanyId], references: [id])
  members              HouseholdMember[]
  invites              HouseholdInvite[]
  statements           Statement[]
  expenses             Expense[]
  @@map("households")
}

model HouseholdMember {
  id          String @id @default(cuid())
  householdId String @map("household_id")
  companyId   String @unique @map("company_id")
  role        String
  household   Household @relation(fields: [householdId], references: [id])
  company     Company   @relation(fields: [companyId], references: [id])
  @@unique([householdId, companyId])
  @@map("household_members")
}

model HouseholdInvite {
  id          String @id @default(cuid())
  householdId String @map("household_id")
  email       String
  status      String @default("pending")
  household   Household @relation(fields: [householdId], references: [id])
  @@map("household_invites")
}

model Statement {
  id               String   @id @default(cuid())
  householdId      String   @map("household_id")
  addedByCompanyId String   @map("added_by_company_id")
  filename         String
  format           String
  importedAt       DateTime @default(now()) @map("imported_at")
  household        Household @relation(fields: [householdId], references: [id])
  expenses         Expense[]
  @@map("statements")
}

model Expense {
  id               String   @id @default(cuid())
  householdId      String   @map("household_id")
  addedByCompanyId String   @map("added_by_company_id")
  statementId      String?  @map("statement_id")
  spentOn          DateTime @map("spent_on") @db.Date
  merchant         String
  category         String
  fixed            Boolean
  amountCents      Int      @map("amount_cents")
  household        Household @relation(fields: [householdId], references: [id])
  statement        Statement? @relation(fields: [statementId], references: [id])
  @@index([householdId, spentOn])
  @@map("expenses")
}

model LessonProgress {
  companyId String  @map("company_id")
  lessonId  String  @map("lesson_id")
  completed Boolean
  company   Company @relation(fields: [companyId], references: [id])
  @@id([companyId, lessonId])
  @@map("lesson_progress")
}
```

Add `lessonProgress LessonProgress[]` on `Company`.

- [ ] **Step 2: Write the SQL migration**

`apps/api/prisma/migrations/20261014210000_household_expenses/migration.sql` creates those tables and the unique indexes on `households.owner_company_id` and `household_members.company_id`. `priorities` is `TEXT[] NOT NULL DEFAULT '{}'`.

- [ ] **Step 3: Generate the client**

Run: `pnpm --filter @yield2pay/api exec prisma generate`

Expected: "Generated Prisma Client"

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20261014210000_household_expenses
git commit -m "feat: add household expense tables"
```

---

### Task 3: Create one household per person

**Files:**
- Create: `apps/api/src/household/household.service.ts`
- Create: `apps/api/src/household/household.service.spec.ts`
- Create: `apps/api/src/household/household.errors.ts`

**Interfaces:**
- Consumes: Prisma `household` and `householdMember`
- Produces: `HouseholdService.create(companyId, name)` and `HouseholdService.requireMembership(companyId)` returning `{ householdId, role }`

- [ ] **Step 1: Write the failing test**

```ts
import { HouseholdService } from './household.service';
import { HouseholdConflictError } from './household.errors';

it('creates a household and an owner membership', async () => {
  const prisma = fakePrisma();
  prisma.householdMember.findUnique.mockResolvedValue(null);
  prisma.household.create.mockResolvedValue({ id: 'h1', name: 'Casa 1' });
  const svc = new HouseholdService(prisma as never);
  const created = await svc.create('co_1', 'Casa 1');
  expect(created).toEqual({ id: 'h1', name: 'Casa 1', role: 'owner' });
  expect(prisma.householdMember.create).toHaveBeenCalledWith({
    data: { householdId: 'h1', companyId: 'co_1', role: 'owner' },
  });
});

it('rejects a second household for the same person', async () => {
  const prisma = fakePrisma();
  prisma.householdMember.findUnique.mockResolvedValue({ companyId: 'co_1' });
  const svc = new HouseholdService(prisma as never);
  await expect(svc.create('co_1', 'Outra')).rejects.toBeInstanceOf(HouseholdConflictError);
});
```

`fakePrisma()` returns `vi.fn()` mocks for `householdMember.findUnique`, `household.create`, and `householdMember.create`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @yield2pay/api exec vitest run src/household/household.service.spec.ts`

Expected: FAIL with cannot find module `./household.service`

- [ ] **Step 3: Write minimal implementation**

`HouseholdConflictError` and `HouseholdForbiddenError` extend `Error`.

`create` looks up `householdMember` by `companyId`. If a row exists, throw `HouseholdConflictError`. Otherwise `household.create` then `householdMember.create` with `role: 'owner'`.

`requireMembership` returns `{ householdId, role }` or throws `HouseholdNotFoundError` when `findUnique` is null.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @yield2pay/api exec vitest run src/household/household.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/household
git commit -m "feat: create one household group per person"
```

---

### Task 4: Account and profile

**Files:**
- Modify: `apps/api/src/household/household.service.ts`
- Modify: `apps/api/src/household/household.service.spec.ts`
- Create: `apps/api/src/household/household.controller.ts`
- Create: `apps/api/src/household/household.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `HouseholdService.requireMembership`
- Produces: `getAccount(companyId, privyName)`, `putProfile`, `patchProfile`, `skipProfile`

- [ ] **Step 1: Write the failing tests**

```ts
it('returns family account initials from the full name', async () => {
  const prisma = fakePrisma();
  prisma.personName.findUnique.mockResolvedValue({
    displayName: 'Ana', fullName: 'Ana Lima',
  });
  prisma.householdMember.findUnique.mockResolvedValue(null);
  const svc = new HouseholdService(prisma as never);
  const account = await svc.getAccount('co_1');
  expect(account).toMatchObject({
    initials: 'AL',
    accountType: 'family',
    household: null,
  });
});

it('putProfile marks onboarding complete', async () => {
  const prisma = fakePrisma();
  prisma.householdMember.findUnique.mockResolvedValue({
    householdId: 'h1', role: 'member',
  });
  const svc = new HouseholdService(prisma as never);
  await svc.putProfile('co_1', {
    householdSize: 'two',
    monthlyIncomeCents: 500000,
    reserveCents: 100000,
    priorities: ['reserva'],
    goalMonths: 12,
    cryptoExperience: 'declined',
  });
  expect(prisma.household.update).toHaveBeenCalledWith({
    where: { id: 'h1' },
    data: expect.objectContaining({ onboardingCompleted: true, goalMonths: 12 }),
  });
});

it('skip only sets onboardingCompleted', async () => {
  const prisma = fakePrisma();
  prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'owner' });
  const svc = new HouseholdService(prisma as never);
  await svc.skip('co_1');
  expect(prisma.household.update).toHaveBeenCalledWith({
    where: { id: 'h1' },
    data: { onboardingCompleted: true },
  });
});

it('patch beginner does not change onboardingCompleted', async () => {
  const prisma = fakePrisma();
  prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'member' });
  const svc = new HouseholdService(prisma as never);
  await svc.patchProfile('co_1', { cryptoExperience: 'beginner' });
  expect(prisma.household.update).toHaveBeenCalledWith({
    where: { id: 'h1' },
    data: { cryptoExperience: 'beginner' },
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @yield2pay/api exec vitest run src/household/household.service.spec.ts`

Expected: FAIL with `getAccount` is not a function

- [ ] **Step 3: Write minimal implementation**

`initialsOf(fullName, displayName)` takes the first letter of each of the first two words, uppercased. One word yields one letter. Empty yields `'?'`.

`putProfile` writes every field and `onboardingCompleted: true`. `patchProfile` writes only the keys present. `skip` writes only `onboardingCompleted: true`. All three call `requireMembership` first.

Controller routes, all behind `AuthGuard`:

- `GET /account` → `getAccount`
- `POST /households` body `{ name: string }` → `create`. Map `HouseholdConflictError` to HTTP 409.
- `GET /household/profile` → profile. Map not-found to 404.
- `PUT /household/profile`
- `PATCH /household/profile`
- `POST /household/profile/skip`

Register `HouseholdModule` in `AppModule`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @yield2pay/api exec vitest run src/household/household.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/household apps/api/src/app.module.ts
git commit -m "feat: add household account and profile routes"
```

---

### Task 5: Invites

**Files:**
- Modify: `apps/api/src/household/household.service.ts`
- Modify: `apps/api/src/household/household.service.spec.ts`
- Modify: `apps/api/src/household/household.controller.ts`

**Interfaces:**
- Consumes: `requireMembership`, `HouseholdForbiddenError`, `HouseholdConflictError`
- Produces: `invite(companyId, email)`, `acceptInvite(companyId, inviteId, email)`, `revokeInvite(companyId, inviteId)`

- [ ] **Step 1: Write the failing test**

```ts
it('lets only the owner invite, and blocks someone already in a group', async () => {
  const prisma = fakePrisma();
  prisma.householdMember.findUnique.mockResolvedValue({ householdId: 'h1', role: 'member' });
  const svc = new HouseholdService(prisma as never);
  await expect(svc.invite('co_member', 'bia@example.com')).rejects.toBeInstanceOf(HouseholdForbiddenError);
});

it('accepts a pending invite when the Google email matches and the person is free', async () => {
  const prisma = fakePrisma();
  prisma.householdInvite.findUnique.mockResolvedValue({
    id: 'inv1', householdId: 'h1', email: 'bia@example.com', status: 'pending',
  });
  prisma.householdMember.findUnique.mockResolvedValue(null);
  const svc = new HouseholdService(prisma as never);
  await svc.acceptInvite('co_bia', 'inv1', 'Bia@example.com');
  expect(prisma.householdMember.create).toHaveBeenCalledWith({
    data: { householdId: 'h1', companyId: 'co_bia', role: 'member' },
  });
  expect(prisma.householdInvite.update).toHaveBeenCalledWith({
    where: { id: 'inv1' },
    data: { status: 'accepted' },
  });
});

it('rejects accept when the person already belongs to a group', async () => {
  const prisma = fakePrisma();
  prisma.householdInvite.findUnique.mockResolvedValue({
    id: 'inv1', householdId: 'h1', email: 'bia@example.com', status: 'pending',
  });
  prisma.householdMember.findUnique.mockResolvedValue({ companyId: 'co_bia' });
  const svc = new HouseholdService(prisma as never);
  await expect(svc.acceptInvite('co_bia', 'inv1', 'bia@example.com')).rejects.toBeInstanceOf(HouseholdConflictError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @yield2pay/api exec vitest run src/household/household.service.spec.ts`

Expected: FAIL with `invite` is not a function

- [ ] **Step 3: Write minimal implementation**

`invite` requires `role === 'owner'`, otherwise `HouseholdForbiddenError`. Normalize email with `trim().toLowerCase()`. If any `householdMember` exists whose company email equals that address, throw `HouseholdConflictError`. The service receives the invitee's existing membership by email through `prisma.householdInvite` and a lookup argument: store the pending row. A second pending row for the same household and email throws `HouseholdConflictError`.

`acceptInvite` loads the invite. Emails compare after lowercase. Status must be `pending`. The caller's membership must be absent. Then create `member` and set status `accepted`. Any miss throws `HouseholdConflictError`.

`revokeInvite` is owner-only and sets `status: 'revoked'` when the invite is still `pending` and belongs to the owner's household.

`PrivyService.verify` stays as it is. Add `getEmail(privyUserId: string): Promise<string | null>` that calls `this.client.getUser(privyUserId)` and returns the Google or email account address, lowercased, or `null`.

`AuthGuard` calls `getEmail` after a successful verify and sets `req.email` on `AuthenticatedRequest` (`email: string | null`). `getAccount` writes that email onto `PersonName` when it is non-null.

Controller:

- `POST /households/current/invites` body `{ email }`
- `POST /households/invites/:id/accept` has an empty body. It calls `acceptInvite(req.companyId, id, req.email)`. A null email throws `HouseholdConflictError`.
- `POST /households/invites/:id/revoke`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @yield2pay/api exec vitest run src/household/household.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/household apps/api/src/auth apps/api/prisma
git commit -m "feat: invite household members by email"
```

---

### Task 6: Classify and parse amounts

**Files:**
- Create: `apps/api/src/expenses/classify.ts`
- Create: `apps/api/src/expenses/classify.spec.ts`
- Create: `apps/api/src/expenses/parse-amount.ts`
- Create: `apps/api/src/expenses/parse-amount.spec.ts`

**Interfaces:**
- Consumes: `ExpenseCategory` from `@yield2pay/shared`
- Produces: `classifyMerchant(merchant: string): ExpenseCategory` and `isFixedRepeat(previousCents: number, nextCents: number): boolean` and `parseAmountToCents(raw: string): number`

- [ ] **Step 1: Write the failing test**

```ts
import { classifyMerchant, isFixedRepeat } from './classify';
import { parseAmountToCents } from './parse-amount';

it('maps grocery keywords and falls back to shopping', () => {
  expect(classifyMerchant('Supermercado Dia')).toBe('groceries');
  expect(classifyMerchant('Padaria')).toBe('shopping');
});

it('treats a repeat within 5 percent as fixed', () => {
  expect(isFixedRepeat(10000, 10400)).toBe(true);
  expect(isFixedRepeat(10000, 10600)).toBe(false);
});

it('parses Brazilian and dot amounts to centavos', () => {
  expect(parseAmountToCents('R$ 1.234,56')).toBe(123456);
  expect(parseAmountToCents('1234.56')).toBe(123456);
  expect(parseAmountToCents('-10.50')).toBe(1050);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @yield2pay/api exec vitest run src/expenses/classify.spec.ts src/expenses/parse-amount.spec.ts`

Expected: FAIL with cannot find module

- [ ] **Step 3: Write minimal implementation**

`classifyMerchant` lowercases the text and returns the first match: `aluguel` or `condominio` → `housing`; `farmacia` or `hospital` → `health`; `escola` or `faculdade` → `education`; `netflix` or `spotify` → `subscriptions`; `mercado` or `supermercado` → `groceries`; `restaurante` or `ifood` → `restaurant`; `uber` or `posto` → `transport`; otherwise `shopping`.

`isFixedRepeat` returns `Math.abs(nextCents - previousCents) / previousCents <= 0.05`. If `previousCents` is `0`, return `false`.

`parseAmountToCents` strips `R$` and spaces. If the string contains a comma, remove dots and replace the comma with a dot. `Math.round(Math.abs(Number(normalized)) * 100)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @yield2pay/api exec vitest run src/expenses/classify.spec.ts src/expenses/parse-amount.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/expenses/classify.ts apps/api/src/expenses/classify.spec.ts apps/api/src/expenses/parse-amount.ts apps/api/src/expenses/parse-amount.spec.ts
git commit -m "feat: classify merchants and parse centavos"
```

---

### Task 7: Import CSV, OFX, and PDF

**Files:**
- Create: `apps/api/src/statements/parse-csv.ts`
- Create: `apps/api/src/statements/parse-ofx.ts`
- Create: `apps/api/src/statements/parse-pdf.ts`
- Create: `apps/api/src/statements/parse-statements.spec.ts`
- Create: `apps/api/src/statements/statements.service.ts`
- Create: `apps/api/src/statements/statements.service.spec.ts`
- Create: `apps/api/src/statements/statements.controller.ts`
- Create: `apps/api/src/statements/statements.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `classifyMerchant`, `isFixedRepeat`, `parseAmountToCents`, `HouseholdService.requireMembership`
- Produces: `StatementsService.importFile(companyId, filename, bytes)` returning `{ statementId, imported, skipped }`

A parsed row is `{ spentOn: string, merchant: string, amountCents: number }`.

- [ ] **Step 1: Write the failing parser test**

```ts
import { parseCsv } from './parse-csv';
import { parseOfx } from './parse-ofx';

it('reads a CSV header in Portuguese', () => {
  const text = 'data,descricao,valor\n12/10/2026,Supermercado Dia,"1.234,56"\n';
  expect(parseCsv(text)).toEqual([
    { spentOn: '2026-10-12', merchant: 'Supermercado Dia', amountCents: 123456 },
  ]);
});

it('reads one OFX debit as a positive centavo amount', () => {
  const text = `<STMTTRN><DTPOSTED>20261012</DTPOSTED><TRNAMT>-10.50</TRNAMT><NAME>Uber</NAME></STMTTRN>`;
  expect(parseOfx(text)).toEqual([
    { spentOn: '2026-10-12', merchant: 'Uber', amountCents: 1050 },
  ]);
});
```

And the service test: given a household membership and no earlier expense, `importFile` creates a statement and an expense with `category: 'groceries'`, `fixed: false`, and `addedByCompanyId` equal to the caller. A second call with the same merchant and amount within 5 percent sets `fixed: true`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @yield2pay/api exec vitest run src/statements/parse-statements.spec.ts src/statements/statements.service.spec.ts`

Expected: FAIL with cannot find module

- [ ] **Step 3: Write minimal implementation**

`parseCsv` requires headers `data` or `date`, `descricao` or `description` or `memo`, and `valor` or `amount`. Missing header throws `StatementFormatError`. Dates `DD/MM/YYYY` become `YYYY-MM-DD`.

`parseOfx` finds each `STMTTRN` block. `DTPOSTED` uses the first 8 digits `YYYYMMDD`. Merchant is `NAME`, otherwise `MEMO`. No blocks throws `StatementFormatError`.

`parsePdf` receives already-extracted text. A line matches `/(\d{2}\/\d{2}\/\d{4}).*?(\d{1,3}(?:\.\d{3})*,\d{2})/`. The merchant is the text between the date and the amount, trimmed. Non-matching lines increment `skipped` and are not returned. The service treats zero parsed PDF rows as `StatementFormatError`.

Use `pdf-parse` only inside `statements.service.ts` to turn a PDF buffer into text before `parsePdf`. Add the dependency with `pnpm --filter @yield2pay/api add pdf-parse`.

`importFile` calls `requireMembership`, detects format from the filename extension (`.ofx`, `.csv`, `.pdf`; else `StatementFormatError`), parses, then for each row looks up an earlier expense in the same household with the same lowercased merchant. `fixed` uses `isFixedRepeat` against the latest earlier amount. Insert the statement, then the expenses with `addedByCompanyId: companyId`.

`POST /statements` uses Nest `FileInterceptor('file')`. Map `StatementFormatError` to HTTP 400.

Register `StatementsModule` in `AppModule`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @yield2pay/api exec vitest run src/statements`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/statements apps/api/src/app.module.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat: import household statements into shared expenses"
```

---

### Task 8: List and correct expenses

**Files:**
- Create: `apps/api/src/expenses/expenses.service.ts`
- Create: `apps/api/src/expenses/expenses.service.spec.ts`
- Create: `apps/api/src/expenses/expenses.controller.ts`
- Create: `apps/api/src/expenses/expenses.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `HouseholdService.requireMembership`, `ExpenseView`
- Produces: `list(companyId, month, category?)`, `months(companyId)`, `patch(companyId, id, { category?, fixed? })`

- [ ] **Step 1: Write the failing test**

```ts
it('lists the group and attaches the adder name', async () => {
  const prisma = fakePrisma();
  membership(prisma, 'h1');
  prisma.expense.findMany.mockResolvedValue([{
    id: 'e1', spentOn: new Date('2026-10-12T00:00:00Z'), merchant: 'Uber',
    category: 'transport', fixed: false, amountCents: 1050, addedByCompanyId: 'co_bia',
  }]);
  prisma.personName.findMany.mockResolvedValue([
    { companyId: 'co_bia', displayName: 'Bia', fullName: 'Bia Souza' },
  ]);
  const svc = new ExpensesService(prisma as never, households as never);
  const rows = await svc.list('co_ana', '2026-10');
  expect(rows[0].addedBy).toEqual({ displayName: 'Bia', initials: 'BS' });
  expect(rows[0].date).toBe('2026-10-12');
});

it('does not patch an expense outside the group', async () => {
  const prisma = fakePrisma();
  membership(prisma, 'h1');
  prisma.expense.findFirst.mockResolvedValue(null);
  const svc = new ExpensesService(prisma as never, households as never);
  await expect(svc.patch('co_ana', 'e_other', { fixed: true })).rejects.toBeInstanceOf(ExpenseNotFoundError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @yield2pay/api exec vitest run src/expenses/expenses.service.spec.ts`

Expected: FAIL with cannot find module

- [ ] **Step 3: Write minimal implementation**

`list` filters `householdId` and `spentOn` inside the UTC month parsed from `YYYY-MM`, optional `category`, order `spentOn desc`. It loads `PersonName` for the distinct `addedByCompanyId` values. A missing name uses initials `'?'` and displayName `'Membro'`.

`months` returns distinct `YYYY-MM` from the group's `spentOn`, newest first.

`patch` finds the expense with `id` and `householdId`. Null throws `ExpenseNotFoundError`. Update only the provided `category` and `fixed`. Do not change `addedByCompanyId`.

Controller: `GET /expenses`, `GET /expenses/months`, `PATCH /expenses/:id`. Register `ExpensesModule`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @yield2pay/api exec vitest run src/expenses/expenses.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/expenses apps/api/src/app.module.ts
git commit -m "feat: list and correct shared household expenses"
```

---

### Task 9: Month summary

**Files:**
- Create: `apps/api/src/summary/summary.math.ts`
- Create: `apps/api/src/summary/summary.math.spec.ts`
- Create: `apps/api/src/summary/summary.service.ts`
- Create: `apps/api/src/summary/summary.controller.ts`
- Create: `apps/api/src/summary/summary.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: household expenses and profile fields `monthlyIncomeCents`, `reserveCents`, `goalMonths`
- Produces: `summarize(input): HouseholdSummary` and `GET /household/summary?month=YYYY-MM`

- [ ] **Step 1: Write the failing test**

Pin `today` as `2026-10-12`. Expenses in October through the 12th: one fixed `10000` on day 2 (merchant `Aluguel`) and one variable `5000` on day 10. September has a fixed `Aluguel` of `10000` on day 20 and nothing else. Income `500000`, reserve `100000`, goal `12`. Five months before October are empty, so `averageCents` is `0` and `freedom` is `null`.

```ts
expect(result.monthTotalCents).toBe(15000);
expect(result.projectedCents).toBe(10000 + 10000 + Math.round(5000 / 12) * 31);
expect(result.freedom).toBeNull();
expect(result.changePercent).toBeNull();
```

`projectedCents` uses the spec formula: fixed so far `10000`, plus September's fixed still to come `10000` (day 20 is after today and the merchant is not already in October — wait, Aluguel IS already in October, so `fixedStillToCome` is `0`). Correct expectation:

```ts
expect(result.projectedCents).toBe(10000 + Math.round((5000 / 12) * 31));
```

Add a second case with no October rent: `fixedStillToCome` is `10000`.

Add a case with five prior months totaling `10000` each: `averageCents` is `10000`, `freedom.months` is `10`, `freedom.missingCents` is `12 * 10000 - 100000`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @yield2pay/api exec vitest run src/summary/summary.math.spec.ts`

Expected: FAIL with cannot find module

- [ ] **Step 3: Write minimal implementation**

`summarize` in `summary.math.ts` is a pure function. It takes `{ month, today, expenses, incomeCents, reserveCents, goalMonths }` where each expense is `{ spentOn: string, merchant: string, category, fixed, amountCents }`.

`saoPauloToday(now: Date)` formats `now` with `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })` which yields `YYYY-MM-DD`.

The controller loads the membership, the household profile, and expenses from six months before `month` through `month`, then calls `summarize`.

Register `SummaryModule` with `GET /household/summary`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @yield2pay/api exec vitest run src/summary/summary.math.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/summary apps/api/src/app.module.ts
git commit -m "feat: compute the household month summary"
```

---

### Task 10: Lessons

**Files:**
- Create: `apps/api/src/lessons/lesson-catalog.ts`
- Create: `apps/api/src/lessons/lessons.service.ts`
- Create: `apps/api/src/lessons/lessons.service.spec.ts`
- Create: `apps/api/src/lessons/lessons.controller.ts`
- Create: `apps/api/src/lessons/lessons.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `LessonView`, `LessonProgressView`
- Produces: `list(track)`, `progress(companyId)`, `setCompleted(companyId, lessonId, completed)`, `reset(companyId)`

- [ ] **Step 1: Write the failing test**

```ts
it('returns four beginner lessons and resets progress for the person only', async () => {
  const prisma = { lessonProgress: {
    findMany: vi.fn().mockResolvedValue([{ lessonId: 'beginner-1', completed: true }]),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  } };
  const svc = new LessonsService(prisma as never);
  expect(svc.list('beginner')).toHaveLength(4);
  await svc.setCompleted('co_1', 'beginner-1', true);
  await svc.reset('co_1');
  expect(prisma.lessonProgress.deleteMany).toHaveBeenCalledWith({ where: { companyId: 'co_1' } });
});

it('rejects an unknown lesson id', async () => {
  const svc = new LessonsService({ lessonProgress: {} } as never);
  await expect(svc.setCompleted('co_1', 'nope', true)).rejects.toBeInstanceOf(LessonNotFoundError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @yield2pay/api exec vitest run src/lessons/lessons.service.spec.ts`

Expected: FAIL with cannot find module

- [ ] **Step 3: Write minimal implementation**

`lesson-catalog.ts` exports two arrays of four `{ id, title, durationMinutes }`. Ids are `beginner-1` through `beginner-4` and `fund-1` through `fund-4`. Titles: "O que é uma carteira", "Custódia das suas chaves", "O que é um cofre", "Por que o rendimento não é gasto" for `beginner`, with durations `4`, `5`, `6`, `4`. Fundo titles: "O que muda no fundo", "Risco e prazo", "Como o aporte entra", "Como o resgate sai", durations `5`, `6`, `5`, `4`.

`list('beginner' | 'fund')` returns that array. Any other track throws `LessonTrackError` (HTTP 400).

`progress` returns every catalog lesson. A missing row is `completed: false`.

`setCompleted` upserts. Unknown id throws `LessonNotFoundError` (HTTP 404).

`reset` deletes every row for `companyId`.

Routes: `GET /lessons?track=`, `GET /lesson-progress`, `PUT /lesson-progress/:id` body `{ completed: boolean }`, `DELETE /lesson-progress`.

Register `LessonsModule`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @yield2pay/api exec vitest run src/lessons/lessons.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lessons apps/api/src/app.module.ts
git commit -m "feat: add household lesson progress"
```

---

### Task 11: Web session gate without a wallet

**Files:**
- Create: `apps/web/src/app/family/_components/FamilySessionGate.tsx`
- Create: `apps/web/src/app/family/_components/FamilySessionGate.test.tsx`
- Create: `apps/web/src/app/family/_lib/householdApi.ts`
- Modify: `apps/web/src/app/family/layout.tsx`

**Interfaces:**
- Consumes: `usePrivy` (`ready`, `authenticated`, `getAccessToken`) and `AccountView`
- Produces: `FamilySessionGate` and `createHouseholdApi(getToken)`

- [ ] **Step 1: Write the failing test**

```tsx
const ensureWallet = vi.fn();
vi.mock('@/lib/useWallet', () => ({ useWallet: () => ({ ensureWallet }) }));
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ ready: true, authenticated: true, getAccessToken: async () => 'tok' }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import { render, screen } from '@testing-library/react';
import { FamilySessionGate } from './FamilySessionGate';

it('renders children without creating a wallet', () => {
  render(<FamilySessionGate><p>painel</p></FamilySessionGate>);
  expect(screen.getByText('painel')).toBeTruthy();
  expect(ensureWallet).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @yield2pay/web exec vitest run src/app/family/_components/FamilySessionGate.test.tsx`

Expected: FAIL with cannot find module

- [ ] **Step 3: Write minimal implementation**

`FamilySessionGate` uses `usePrivy` only. When `ready` is false, render `null`. When not authenticated, `router.replace('/login')` and render `null`. Otherwise render `children`. Do not import `useWallet`.

`createHouseholdApi` builds `GET` helpers for `/account`, `/expenses`, `/expenses/months`, and `/household/summary` using `NEXT_PUBLIC_API_BASE_URL` and `Authorization: Bearer`.

Wrap `{children}` in `family/layout.tsx` with `FamilySessionGate` inside the existing `FamilyProvider`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @yield2pay/web exec vitest run src/app/family/_components/FamilySessionGate.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/family/_components/FamilySessionGate.tsx apps/web/src/app/family/_components/FamilySessionGate.test.tsx apps/web/src/app/family/_lib/householdApi.ts apps/web/src/app/family/layout.tsx
git commit -m "feat: open the family expense session without a wallet"
```

The pixel layout of `/family/dashboard` stays as it is until the prototype arrives. `householdApi` is the only new data access.

---

## Self-review

Spec coverage: group limit and invites (Tasks 3 and 5), account and profile including skip and crypto patch (Task 4), CSV/OFX/PDF import and who added the row (Task 7), list, months, and patch (Task 8), summary formulas (Task 9), lessons and reset (Task 10), web gate without `ensureWallet` (Task 11). Screen pixels stay out, matching the spec.
