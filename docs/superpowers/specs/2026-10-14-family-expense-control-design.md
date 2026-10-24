# Controle de gastos da família — Design Spec

**Date:** 2026-10-14
**Area:** `apps/api`, `packages/shared`, `apps/web` (`/family`)
**Ships:** the family expense panel backend, plus a web module that calls it. The visual layout waits for the prototype.

## Goal

The first page of `/family/dashboard` is expense control for a household. It has no wallet, vault, deposit, or withdraw. Google login identifies the person. Blockchain onboarding, the Stellar wallet, and the vault stay in the repo and are not linked from this page.

## Decisions

- One site, two modules. This version builds only the expense module.
- The logged-in person is the existing `Company` row created from the Privy user id. No new user table.
- Spending belongs to one household group, not to a single person. Each person belongs to at most one group, whether they created it or joined it. The creator invites other accounts by email. Every expense records who added it.
- Money is integer centavos of BRL. `R$ 12,50` is `1250`.
- "Today" is the calendar date of the API server in `America/Sao_Paulo`.
- Category and fixed/variable classification is rule-based. The person can correct both.
- Lesson content is a constant in the API. Progress is stored per company.
- The current family `AuthGate` is not used here. That gate creates a Stellar wallet. The expense pages only require a Privy session and send its access token.
- The screen layout is out of this spec. The web module exposes load, save, import, and summary. The prototype decides the pixels.

## What this version does not build

- Blockchain onboarding, wallet creation, deposit, withdraw, vault, and the current subscription dashboard as the entry page.
- Budget caps and a comparison of spending against yield.
- Machine-learning classification.
- A second login system.

The existing family screens for subscriptions, deposit, withdraw, and the vault stay in the tree. The expense page does not link to them.

## Modules

| Module | Responsibility | Depends on |
|---|---|---|
| `household` API | Account, the one group, invites, profile, onboarding flags | `AuthGuard`, `Company` |
| `statements` API | Accept OFX, CSV, and PDF and write expenses on the group | `household` |
| `expenses` API | List, filter, and correct one expense of the group | `household` |
| `summary` API | Month math for the group | `expenses`, group profile |
| `lessons` API | Four lessons per track and completion, per person | `Company` |
| Shared types | Request and response shapes | none |
| Family expense web | Calls only the routes above | Shared types, Privy session |
| Parked family blockchain | Unchanged screens, no entry from expenses | none in this version |

## Data model

```
PersonName
  companyId            unique
  displayName          string, optional until Privy supplies one
  fullName             string, optional

Household
  id
  name                 string, for example "Casa 1"
  ownerCompanyId       unique
  householdSize        solo | two | three_to_four | five_or_more, optional
  monthlyIncomeCents   int, optional
  reserveCents         int, optional
  priorities           string[]
  goalMonths           6 | 12 | 24 | 60, optional
  cryptoExperience     beginner | fund | declined, optional
  onboardingCompleted  bool, default false

HouseholdMember
  householdId
  companyId            unique
  role                 owner | member
  unique (householdId, companyId)

HouseholdInvite
  householdId
  email                normalized lowercase
  status               pending | accepted | revoked
  unique pending invite per (householdId, email)

Statement
  householdId
  addedByCompanyId
  filename
  format               ofx | csv | pdf
  importedAt

Expense
  householdId
  addedByCompanyId
  statementId          optional
  spentOn              date
  merchant             string
  category             housing | health | education | subscriptions | groceries | restaurant | transport | shopping
  fixed                bool
  amountCents          int, greater than 0

LessonProgress
  companyId
  lessonId
  completed            bool
  unique (companyId, lessonId)
```

`ownerCompanyId` unique means one person creates at most one household. `HouseholdMember.companyId` unique means one person belongs to at most one household.

`GET /account` derives `initials` from `fullName`, then `displayName`, then the email local-part. `accountType` is always `"family"`.

On the first `GET /account` for a company with an empty name, the API copies the name Privy already has onto `PersonName`.

## Routes

All routes require `Authorization: Bearer <privy access token>`. A missing or invalid token is `401`.

### Account

`GET /account`

```
{
  displayName, fullName, initials,
  accountType: "family",
  household: null | { id, name, role: "owner" | "member", onboardingCompleted }
}
```

`household` is `null` until the person creates a group or accepts an invite.

### Group

`POST /households` body `{ name }` creates the group and adds the caller as `owner`. A person who already belongs to a group gets `409`.

`GET /households/current` returns the group, its members (`displayName`, `initials`, `role`), and, for the owner, the pending invites. A person with no group gets `404`.

`POST /households/current/invites` body `{ email }` is owner-only. The email is stored lowercase. A second pending invite for the same email in that group gets `409`. Inviting an address that already belongs to any group gets `409`. A member who is not the owner gets `403`.

`POST /households/invites/:id/accept` is called by the logged-in person. The invite email must equal the Google email on their Privy account, and the invite must be `pending`. Their `HouseholdMember.companyId` must still be free. Success marks the invite `accepted` and adds them as `member`. A mismatch or a full membership gets `409`.

`POST /households/invites/:id/revoke` is owner-only and sets a pending invite to `revoked`.

Any member can read and update the group profile. Routes below that read or write expenses require membership. No group is `404` on those routes.

### Profile

`GET /household/profile` returns the group's profile. Missing optional fields are `null`. `priorities` is `[]` when unset. The caller must be a member.

`PUT /household/profile` replaces the editable fields:

| Field | Values |
|---|---|
| `householdSize` | `solo`, `two`, `three_to_four`, `five_or_more` |
| `monthlyIncomeCents` | integer ≥ 0 |
| `reserveCents` | integer ≥ 0 |
| `priorities` | list of strings |
| `goalMonths` | `6`, `12`, `24`, `60` |
| `cryptoExperience` | `beginner`, `fund`, `declined` |

A successful `PUT` sets `onboardingCompleted` to `true`.

`POST /household/profile/skip` sets `onboardingCompleted` to `true` and leaves the other fields as they are.

`PATCH /household/profile` accepts any subset of the editable fields. The "I am interested" action sends `{ "cryptoExperience": "beginner" }` and does not change `onboardingCompleted`.

### Statements

`POST /statements` is `multipart/form-data` with one file field, `file`.

Accepted types: OFX, CSV, PDF. Anything else is `400`.

The parser writes one `Expense` per recognized transaction and returns:

```
{ statementId, imported, skipped }
```

`imported` is how many expenses were stored. `skipped` is how many lines or pages could not be read.

Amounts in CSV accept `1234.56`, `1.234,56`, and an optional `R$` prefix. OFX `TRNAMT` uses a dot as the decimal separator. The stored value is the absolute value in centavos.

Classification for each expense:

- Category comes from the first matching keyword in the merchant text, case-insensitive: `aluguel`/`condominio` → `housing`; `farmacia`/`hospital` → `health`; `escola`/`faculdade` → `education`; `netflix`/`spotify` → `subscriptions`; `mercado`/`supermercado` → `groceries`; `restaurante`/`ifood` → `restaurant`; `uber`/`posto` → `transport`. No match stores `shopping`.
- `fixed` is `true` when the same group already has an expense with the same merchant text in lowercase and an amount within 5 percent, in an earlier month. Otherwise `fixed` is `false`.
- `addedByCompanyId` is the member who uploaded the file.

CSV requires a header row. Recognized column names, in Portuguese or English: date (`data`, `date`), merchant (`descricao`, `description`, `memo`), amount (`valor`, `amount`). Dates accept `YYYY-MM-DD` and `DD/MM/YYYY`. A missing required column is `400` and stores nothing.

OFX uses `STMTTRN` (`DTPOSTED`, `NAME` or `MEMO`, `TRNAMT`). A file with no statement transactions is `400`.

PDF text is scanned for lines that contain a date and an amount. Lines that do not match are counted in `skipped`. A PDF that yields zero expenses is `400`.

Amounts are absolute values in centavos. The sign of a bank debit does not change the stored amount.

### Expenses

`GET /expenses?month=YYYY-MM&category=<category>`

`month` is required. `category` is optional. The list is the group's expenses in that month, newest `spentOn` first. Every member sees the same list.

Each item:

```
{ id, date, merchant, category, fixed, amountCents, addedBy: { displayName, initials } }
```

`date` is `YYYY-MM-DD`. `merchant` is the screen's store name. `addedBy` is the member who imported or corrected the row's origin. A later category correction does not change `addedBy`.

`GET /expenses/months` returns the distinct `YYYY-MM` values that have at least one expense in the group, newest first.

`PATCH /expenses/:id` accepts `category` and `fixed`, either or both. Any member of the group may correct it. An expense outside the group is `404`.

### Summary

`GET /household/summary?month=YYYY-MM`

`month` is required. The response is computed on the server. The web page does not recompute it.

Let `today` be the São Paulo calendar date. A month is in progress when it is the month of `today`. For an in-progress month, partial totals include expenses with `spentOn` day ≤ today's day. A closed month uses every expense in that month.

`previousMonth` is the calendar month before `month`.

`averageCents` is the mean of the closed months before today's month, at most five, and never a month before the household's first expense. The open month and any later month contribute `0` to this mean. A closed month inside that window with no expenses contributes `0`. `freedom` uses this same figure no matter which month is on screen.

```
monthTotalCents
previousComparableCents
changePercent          null when previousComparableCents is 0
projectedCents
leftoverCents          monthlyIncomeCents − projectedCents, null when income is unset
byCategory             [{ category, amountCents }] descending by amount
lastSixMonths          [{ month, amountCents }] oldest first, six months ending at `month`
averageCents
dailyPace              { current: number[days], previous: number[days] }
fixedVsVariable        [{ month, fixedCents, variableCents }] for lastSixMonths
freedom                { months, missingCents, deadlineMonths } or null
```

`changePercent` is `(partial − previousPartial) / previousPartial × 100`, rounded to one decimal. For a closed month, both sides are full-month totals.

`projectedCents` for a closed month equals `monthTotalCents`. For the month in progress:

```
fixedStillToCome = previous month's fixed expenses whose day-of-month is after today
                   and whose normalized merchant is not already in this month
variablePerDay   = this month's variable total so far / days elapsed (today's day)
projectedCents   = this month's fixed total so far
                 + fixedStillToCome
                 + variablePerDay × days in the month
```

`dailyPace.current[i]` is the cumulative centavos through day `i + 1` of the selected month. `previous` is the same series for the previous month. Days after today in an in-progress month are omitted from `current`.

`freedom` is `null` when `averageCents` is `0`, or when income is unset, or when `monthlyIncomeCents − averageCents` is `0`. Otherwise:

```
months         = reserveCents / averageCents
missingCents   = goalMonths × averageCents − reserveCents
deadlineMonths = missingCents / (monthlyIncomeCents − averageCents)
```

`months` and `deadlineMonths` are rounded to one decimal. A negative `missingCents` stays negative. That means the reserve already covers the goal.

### Lessons

Four lessons per track, defined in code:

| Track | Query value |
|---|---|
| Zero | `beginner` |
| Fundo | `fund` |

`GET /lessons?track=beginner|fund` returns `[{ id, title, durationMinutes }]` in catalog order. An unknown track is `400`.

`GET /lesson-progress` returns `[{ lessonId, completed }]` for every catalog lesson. Missing rows are `completed: false`.

`PUT /lesson-progress/:id` body `{ completed: boolean }` upserts that lesson for the company. An unknown lesson id is `404`.

`DELETE /lesson-progress` clears every progress row for the company. That is "recomeçar".

## Errors

The existing API error payload is reused (`errorId`, `statusCode`, `timestamp`).

| Situation | Status |
|---|---|
| No or invalid token | 401 |
| Body or query fails validation, including a bad file type | 400 |
| Expense or lesson id is missing, or the expense is outside the caller's group | 404 |
| The person already belongs to a group, or the invite cannot be accepted | 409 |
| A member tries to invite or revoke | 403 |
| Unexpected failure | 500 |

Validation messages name the field. They do not include stack traces when `APP_ENV` is `production`.

## Web boundary

`/family/dashboard` renders the expense module once the prototype exists. Until then, the page may keep its current visuals, but new data calls go only to the routes in this spec.

The module does not import `useWallet`, `AuthGate`, deposit, withdraw, or vault code.

If Privy is not ready, the page waits. If the person is signed out, the page sends them to `/login`. After login it does not call `ensureWallet`.

## Tests

API, with a fake clock set to a known São Paulo date:

1. `GET /account` creates nothing extra and returns `accountType: "family"` and initials.
2. `PUT /household/profile` persists the fields and sets `onboardingCompleted`.
3. `POST /household/profile/skip` sets `onboardingCompleted` without filling the profile.
4. `PATCH` with `{ cryptoExperience: "beginner" }` changes only that field.
5. CSV import stores centavos, assigns a keyword category, and marks a repeated merchant as `fixed`.
6. A member sees an expense imported by another member, including that member's `addedBy` name. A person outside the group does not see it.
7. `POST /households` a second time for the same person returns `409`. Accepting an invite while already in a group returns `409`.
8. Summary for an in-progress month compares only through today's day and fills `projectedCents` from the formula above.
9. `freedom` is `null` when there is no closed month.
10. `PUT` then `DELETE /lesson-progress` completes one lesson and then clears all. Lesson progress stays on the person, not on the group.

Web:

1. The expense page module requests the summary and the month list with the bearer token.
2. The expense page module does not call `ensureWallet`.

## File changes

- Add `PersonName`, `Household`, `HouseholdMember`, `HouseholdInvite`, `Statement`, `Expense`, and `LessonProgress` to `apps/api/prisma/schema.prisma`, plus a migration.
- Add `apps/api/src/household/`, `statements/`, `expenses/`, `summary/`, and `lessons/`.
- Add the shared request and response types in `packages/shared`.
- Add a family session gate that checks Privy auth and does not create a wallet.
- Add the expense data module under `apps/web/src/app/family/`. The prototype replaces the presentation later.

## Out of scope

- Pixel layout of the panel.
- Editing amount, merchant, or date after import.
- Deleting one expense by hand. Correction in this version is category and `fixed`.
- Removing a member who already joined. The owner can revoke a pending invite.
- A person belonging to two groups.
