# Service Catalog — Design Spec

**Date:** 2026-06-29
**Area:** `apps/web` — dashboard "Services" section
**Replaces:** the `Add a recurring bill` form + `Your bills` list (`Bills.tsx`)

## Goal

Faster way to add subscriptions: instead of typing vendor/cost/type by hand, the
user toggles curated software platforms from a card grid. Each toggle is wired to
the existing bills backend — turning a service On creates a bill, Off deletes it.
Capital gating ("your returns can cover") disables services that exceed available
returns.

## Decisions

- **Backend-wired** (not static): toggle On → `createBill`, Off → `deleteBill`.
- **Replace** the manual form + list, **keep** a short "active services" list below the
  grid so custom bills (not in catalog) never become invisible.
- **Currency:** USDC / `$`, consistent with the rest of the dashboard. Prices compare
  directly against `spendable` (USDC). No FX layer.
- **Prices:** taken from the reference mockup (editable in one constant).

## Data model (unchanged backend)

```
Bill          { id, vendor, monthlyCost, type, status }   // monthlyCost = USDC base units (7 dp)
CreateBillDto { vendor, monthlyCost, type }
SpendableView { vaultValue, principal, spendable, apyPercent }
```

Backend fact: `spendable = vaultValue − principal` (= monthly returns, **not** net of
bills). So affordability headroom must subtract committed bills in the frontend:

```
headroom = BigInt(spendable) − Σ BigInt(activeBill.monthlyCost)
```

## Catalog constant — `serviceCatalog.ts`

```ts
export type ServiceCategory = 'ai' | 'productivity' | 'dev';

export interface CatalogService {
  vendor: string;        // exact match key against Bill.vendor
  initials: string;      // avatar text, e.g. 'AI', 'AC'
  monthlyCost: string;   // USDC base units (toBaseUnits of the $ value)
  type: BillType;        // 'software' for all catalog entries
  category: ServiceCategory;
}
```

| vendor            | initials | $/mo  | category     |
|-------------------|----------|-------|--------------|
| OpenAI            | AI       | 49.90 | ai           |
| Anthropic Claude  | AC       | 99.00 | ai           |
| Midjourney        | MJ       | 59.00 | ai           |
| Notion            | N        | 24.90 | productivity |
| Slack             | SL       | 9.50  | productivity |
| Figma             | Fi       | 39.90 | productivity |
| GitHub            | GH       | 21.00 | dev          |
| Linear            | Li       | 16.00 | dev          |

`monthlyCost` stored as base units via `toBaseUnits('49.90')` → `'499000000'` (7 dp).

## Component — `ServiceCatalog.tsx` (replaces `Bills.tsx`)

```ts
interface ServiceCatalogProps {
  bills: Bill[];
  spendable: string;          // USDC base units; '0' when dashboard not loaded
  category: string;           // 'all' | 'ai' | 'productivity' | 'dev'
  onBillsChanged: () => void; // parent refetch (getDashboard + listBills)
}
```

### Per-card derivation

- `activeBill = bills.find(b => b.vendor === entry.vendor)`
- `committed = Σ active bills' monthlyCost`
- `headroom = BigInt(spendable) − committed`
- `affordable = BigInt(entry.monthlyCost) <= headroom`

### Card states

| Condition                         | Toggle    | Label             | Extra                          | Click action            |
|-----------------------------------|-----------|-------------------|--------------------------------|-------------------------|
| `activeBill` exists               | On        | "On" + Active badge | full opacity, glow border    | `deleteBill(id)`        |
| not active, `affordable`          | Off       | "Activate"        | full opacity                   | `createBill({...})`     |
| not active, not `affordable`      | Off, **disabled** | "Needs more capital" | opacity 0.5, "Increase deposit" link → `/deposit` | none |

- Each card has its own `pending` flag; toggle disabled while its request is in flight.
- After any mutation: `onBillsChanged()` (parent refetches → `spendable`, `bills` update).
- On error: per-card inline error message; state reverts (no optimistic commit kept).

### Category filter

Grid shows entries where `category === 'all' || entry.category === category`.

### Active services list (below grid)

- Header: "Your active services".
- Lists **all** `bills` (active = a bill exists), incl. custom ones not in the catalog.
- Each row: avatar (initials/vendor slice) · vendor · `formatUsdc(cost)/mo` · Remove button → `deleteBill(id)`.
- Empty state: "No active services yet. Activate one above."
- Reuses the existing bill-row styling from `Bills.tsx`.

## `page.tsx` changes

1. Category tabs `all/software/utility/other` → `All / AI tools / Productivity / Dev`.
   `tab` state keys become `all/ai/productivity/dev`.
2. Header copy: `servicesTitle` → "Available services"; `servicesSub` →
   "Activate the tools your returns can cover." (update **en** and **pt**).
3. Replace `<Bills bills onBillsChanged tab />` with
   `<ServiceCatalog bills spendable={dashboard?.spendable ?? '0'} category={tab} onBillsChanged />`.
4. Remove `import Bills`.

## File changes

- **Add** `apps/web/src/app/(app)/dashboard/serviceCatalog.ts`
- **Add** `apps/web/src/app/(app)/dashboard/ServiceCatalog.tsx`
- **Add** `apps/web/src/app/(app)/dashboard/ServiceCatalog.test.tsx`
- **Edit** `apps/web/src/app/(app)/dashboard/page.tsx` (tabs, copy, swap component)
- **Delete** `apps/web/src/app/(app)/dashboard/Bills.tsx` + `bills.test.tsx`
- **Edit** `apps/web/src/app/(app)/dashboard/dashboard.test.tsx` (drop bill-form/list assertions, adjust to catalog)

## Tests (TDD)

1. Affordable, inactive card → click toggle → `createBill` called with that vendor/cost/type.
2. Active card (matching bill) → renders "On"/Active → click toggle → `deleteBill(id)`.
3. Inactive + cost > headroom → toggle disabled, "Needs more capital", "Increase deposit" link present.
4. Category filter `ai` → only AI services rendered.
5. Active services list renders a row per bill, incl. a custom vendor outside the catalog.
6. Mutation error → inline error shown, toggle re-enabled.

## Out of scope

- FX / BRL display (would need a rate source).
- Backend-driven catalog (catalog is a frontend constant).
- Editing a catalog service's price from the UI.
