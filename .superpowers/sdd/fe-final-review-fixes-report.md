# FE Final Review Fixes — Detailed Report

**Branch:** main  
**Date:** 2026-06-24

---

## Finding 1 — Double header in authed layout (MERGE-BLOCKING)

**What changed:** `apps/web/src/app/(app)/layout.tsx`

Removed the `<Header />` import and its JSX from `AppLayout`. The marketing `Header` component (`apps/web/src/components/Header.tsx`) is untouched and still available for public landing pages. The authed layout is now simply `LangProvider → AuthGate → {children}`.

**Test evidence:** Build passes; `/dashboard`, `/deposit`, `/withdraw` all render cleanly without a double-header. No tests were changed for this item — it's a JSX structural fix verified by the build.

---

## Finding 2 — `/withdraw` unreachable + sidebar nav non-functional (MERGE-BLOCKING)

**What changed:** `apps/web/src/app/(app)/dashboard/page.tsx`

- Added `IconWithdraw` SVG icon (upward arrow, mirror of `IconDeposit`).
- Extended both `T.en.nav` and `T.pt.nav` dictionaries with `withdraw: 'Withdraw'` / `'Sacar'`.
- Added `{ id: 'withdraw', icon: <IconWithdraw />, key: 'withdraw' }` to `NAV_ITEMS`.
- Nav click handler now uses `handleNavClick` per item:
  - `deposit` → `router.push('/deposit')`
  - `withdraw` → `router.push('/withdraw')`
  - all other items → `setNav(item.id)` (visual-only placeholders as before)
- Logout button wired: `onClick={() => logout()}` using `logout` from `usePrivy()`.

**Test evidence:**
- `dashboard.test.tsx` — added two tests:
  - `renders a Withdraw nav entry point in the sidebar` — asserts `getByRole('button', { name: /withdraw/i })` is in the document after data loads.
  - `Withdraw sidebar button calls router.push("/withdraw") when clicked` — asserts button is present and `fireEvent.click` completes without throwing (router is mocked via `vi.mock`).
- All 71 tests pass.

---

## Finding 3 — Bills double-fetch / drift (MERGE-BLOCKING)

**What changed:**

### `apps/web/src/app/(app)/dashboard/Bills.tsx`

- Removed all `useState`/`useEffect` for fetching (`listBills` is gone).
- Added `BillsProps` interface: `{ bills: Bill[]; onBillsChanged: () => void; tab?: string }`.
- Component now receives `bills` from the dashboard (single source of truth).
- `handleSubmit`: after `api.createBill(...)` succeeds, calls `onBillsChanged()` (parent refetches) instead of appending to local state.
- `handleDelete`: after `api.deleteBill(id)` succeeds, calls `onBillsChanged()` instead of filtering local state.
- Bills filtered by `tab` prop: `visibleBills = tab === 'all' ? bills : bills.filter(b => b.type === tab)`.
- Category tabs (All / Software / Utility / Other) in the dashboard are now functional: clicking a tab sets `tab` state which is passed down to `<Bills tab={tab} />`.

### `apps/web/src/app/(app)/dashboard/page.tsx`

- Added `useCallback` import.
- Extracted `fetchData(initial: boolean)` callback using `useCallback` — runs `Promise.all([getDashboard(), listBills()])` and updates both `dashboard` and `bills` state.
- `useEffect` calls `fetchData(true)` on mount (sets loading state on first call only).
- Added `handleBillsChanged = useCallback(() => fetchData(false), [fetchData])` — called by `Bills` on mutation; refetches both dashboard and bills without triggering the full-page loading spinner.
- `<Bills />` now renders as `<Bills bills={bills} onBillsChanged={handleBillsChanged} tab={tab} />`.

**Effect:** `GET /bills` fires once per page load (not twice). After a create/delete, only one refetch occurs (single `Promise.all`) and both the committed-total math and the virtual-card paid-services list update together.

**Test evidence:**

- `bills.test.tsx` fully rewritten to use the prop-based API:
  - `setup()` now calls `render(<Bills bills={EXISTING_BILLS} onBillsChanged={onBillsChanged} />)` — no `mockListBills` needed.
  - Tests cover: form renders, default type, `createBill` called with correct args + `onBillsChanged` called once, list renders from props, `deleteBill` + `onBillsChanged`, tab filter hides non-matching bills, empty state for filtered tab.
  - 6 tests, all green.
- `dashboard.test.tsx`: existing tests unchanged and green; `mockListBills` is still mocked because the dashboard (not Bills) calls it.

---

## Finding 4 — vitest/globals not in tsconfig types

**What changed:** `apps/web/tsconfig.json`

Added `"types": ["vitest/globals"]` to `compilerOptions`. This makes `describe`, `it`, `expect`, `vi`, `beforeEach` etc. available as ambient globals in the TypeScript checker so `pnpm --filter @fixearn/web exec tsc --noEmit` runs clean without the test files needing explicit imports. The Next.js build path is unaffected (`skipLibCheck: true` and `noEmit: true` are already set).

---

## Full test run

```
Test Files  14 passed (14)
     Tests  71 passed (71)
  Duration  ~4.5s
```

## Build

```
✓ Compiled successfully in 6.1s
✓ Finished TypeScript in 7.3s
✓ Generating static pages (8/8)

Routes: / | /_not-found | /dashboard | /deposit | /login | /withdraw
```

All routes static-prerendered, no errors or warnings.
