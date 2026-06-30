# Service Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual "Add a recurring bill" form + "Your bills" list with a curated, backend-wired service catalog (toggle a platform On = create a bill, Off = delete it), capital-gated by available returns.

**Architecture:** A frontend `SERVICE_CATALOG` constant feeds a new `ServiceCatalog` component that renders a responsive card grid. Each card derives its state (On / Activate / Needs more capital) from the parent's `bills` + `spendable`, and mutates via the existing `createBill`/`deleteBill` API. A new `Toggle` design-system primitive renders the switch. The dashboard page swaps its category tabs to catalog categories and replaces `<Bills>` with `<ServiceCatalog>`.

**Tech Stack:** Next.js (app router) + React, TypeScript, Vitest + Testing Library, existing `@/lib/api`, `@/lib/money`, design-system tokens (`--fx-*`) and primitives (`Badge`, `SegmentedControl`).

## Global Constraints

- **Currency:** USDC base units (7 dp) everywhere; display via `formatUsdc`; UI prefixes `$`. No BRL/FX.
- **Design system:** style with `--fx-*` tokens only (no new hardcoded hex). Reuse `Badge` (Active pill), `SegmentedControl` (category tabs), and the new `Toggle`. Card radius `--fx-radius-xl`, avatar tile `--fx-radius-md`, mono text `--fx-font-mono`.
- **Vendor match is exact:** a catalog card is "active" iff a bill exists with `bill.vendor === entry.vendor` (case-sensitive).
- **Affordability:** `headroom = BigInt(spendable) − Σ BigInt(activeBill.monthlyCost)`; an inactive service is affordable iff `BigInt(cost) <= headroom`. (`spendable = vaultValue − principal`, NOT net of bills.)
- **Commits:** Do NOT commit per task. Per project rule (`CLAUDE.md`), group all changes into ONE commit, created only when the user explicitly asks. No `Co-Authored-By` trailers.
- **Tests run from `apps/web`:** `npx vitest run <path>`.
- **Next.js note:** `apps/web/AGENTS.md` warns this Next.js differs from training data — do not add new framework APIs; this plan only touches client components already in use.

## File Structure

- `apps/web/src/components/Toggle.tsx` — reusable on/off switch primitive (design system).
- `apps/web/src/components/Toggle.test.tsx` — Toggle behavior tests.
- `apps/web/src/app/(app)/dashboard/serviceCatalog.ts` — `SERVICE_CATALOG` constant + types.
- `apps/web/src/app/(app)/dashboard/serviceCatalog.test.ts` — catalog data integrity tests.
- `apps/web/src/app/(app)/dashboard/ServiceCatalog.tsx` — catalog grid + active-services list + mutations.
- `apps/web/src/app/(app)/dashboard/ServiceCatalog.test.tsx` — component behavior tests.
- `apps/web/src/app/(app)/dashboard/page.tsx` — swap tabs/copy/component (modify).
- **Delete:** `apps/web/src/app/(app)/dashboard/Bills.tsx`, `apps/web/src/app/(app)/dashboard/bills.test.tsx`.

---

### Task 1: `Toggle` switch primitive

**Files:**
- Create: `apps/web/src/components/Toggle.tsx`
- Test: `apps/web/src/components/Toggle.test.tsx`

**Interfaces:**
- Consumes: design tokens `--fx-chrome`, `--fx-chrome-ink`, `--fx-surface-2`, `--fx-border-strong`, `--fx-text-2`, `--fx-radius-pill`, `--fx-dur-fast`, `--fx-ease`.
- Produces: `export function Toggle(props: ToggleProps)` where
  `ToggleProps = { checked: boolean; onChange?: () => void; disabled?: boolean; 'aria-label'?: string }`.
  Renders a `<button role="switch" aria-checked={checked}>`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/Toggle.test.tsx`:
```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('renders a switch reflecting the checked prop', () => {
    render(<Toggle checked aria-label="OpenAI" />);
    const sw = screen.getByRole('switch', { name: 'OpenAI' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange when clicked and enabled', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} aria-label="Slack" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Slack' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled aria-label="Linear" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Linear' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Toggle.test.tsx`
Expected: FAIL — cannot resolve `./Toggle`.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/components/Toggle.tsx`:
```tsx
'use client';

import React from 'react';

export interface ToggleProps {
  /** On (true) or off (false). */
  checked: boolean;
  /** Click handler. Not called while disabled. */
  onChange?: () => void;
  /** Disable interaction. @default false */
  disabled?: boolean;
  'aria-label'?: string;
}

/** On/off switch — polished chrome when on, surface well when off. */
export function Toggle({ checked, onChange, disabled = false, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { if (!disabled) onChange?.(); }}
      style={{
        width: 42,
        height: 24,
        borderRadius: 'var(--fx-radius-pill)',
        position: 'relative',
        flexShrink: 0,
        border: checked ? '1px solid transparent' : '1px solid var(--fx-border-strong)',
        background: checked ? 'var(--fx-chrome)' : 'var(--fx-surface-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        padding: 0,
        transition:
          'background var(--fx-dur-fast) var(--fx-ease), border-color var(--fx-dur-fast) var(--fx-ease)',
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: checked ? 'var(--fx-chrome-ink)' : 'var(--fx-text-2)',
          transition: 'left var(--fx-dur-fast) var(--fx-ease)',
        }}
      />
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Toggle.test.tsx`
Expected: PASS (3 tests).

---

### Task 2: `serviceCatalog` constant

**Files:**
- Create: `apps/web/src/app/(app)/dashboard/serviceCatalog.ts`
- Test: `apps/web/src/app/(app)/dashboard/serviceCatalog.test.ts`

**Interfaces:**
- Consumes: `BillType` from `@yield2pay/shared`, `toBaseUnits` from `@/lib/money`.
- Produces:
  - `export type ServiceCategory = 'ai' | 'productivity' | 'dev'`
  - `export interface CatalogService { vendor: string; initials: string; monthlyCost: string; type: BillType; category: ServiceCategory }`
  - `export const SERVICE_CATALOG: CatalogService[]` (8 entries).

- [ ] **Step 1: Write the failing test**

`apps/web/src/app/(app)/dashboard/serviceCatalog.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatUsdc } from '@/lib/money';
import { SERVICE_CATALOG } from './serviceCatalog';

describe('SERVICE_CATALOG', () => {
  it('contains the 8 curated services', () => {
    expect(SERVICE_CATALOG).toHaveLength(8);
    expect(SERVICE_CATALOG.map((s) => s.vendor)).toEqual([
      'OpenAI', 'Anthropic Claude', 'Midjourney',
      'Notion', 'Slack', 'Figma', 'GitHub', 'Linear',
    ]);
  });

  it('stores prices as USDC base units that format back to the mockup values', () => {
    const openai = SERVICE_CATALOG.find((s) => s.vendor === 'OpenAI')!;
    expect(formatUsdc(openai.monthlyCost)).toBe('49.90');
    const slack = SERVICE_CATALOG.find((s) => s.vendor === 'Slack')!;
    expect(formatUsdc(slack.monthlyCost)).toBe('9.50');
  });

  it('only uses known categories and software type', () => {
    const cats = new Set(['ai', 'productivity', 'dev']);
    for (const s of SERVICE_CATALOG) {
      expect(cats.has(s.category)).toBe(true);
      expect(s.type).toBe('software');
      expect(s.monthlyCost).toMatch(/^\d+$/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(app)/dashboard/serviceCatalog.test.ts"`
Expected: FAIL — cannot resolve `./serviceCatalog`.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/app/(app)/dashboard/serviceCatalog.ts`:
```ts
import type { BillType } from '@yield2pay/shared';
import { toBaseUnits } from '@/lib/money';

export type ServiceCategory = 'ai' | 'productivity' | 'dev';

export interface CatalogService {
  /** Exact match key against Bill.vendor. */
  vendor: string;
  /** Avatar tile text. */
  initials: string;
  /** Monthly cost in USDC base units (7 dp). */
  monthlyCost: string;
  /** Bill type persisted on activation. */
  type: BillType;
  /** Frontend-only grouping for the category filter. */
  category: ServiceCategory;
}

/** Curated catalog of popular software subscriptions. Prices are placeholders, edit freely. */
export const SERVICE_CATALOG: CatalogService[] = [
  { vendor: 'OpenAI',           initials: 'AI', monthlyCost: toBaseUnits('49.90'), type: 'software', category: 'ai' },
  { vendor: 'Anthropic Claude', initials: 'AC', monthlyCost: toBaseUnits('99.00'), type: 'software', category: 'ai' },
  { vendor: 'Midjourney',       initials: 'MJ', monthlyCost: toBaseUnits('59.00'), type: 'software', category: 'ai' },
  { vendor: 'Notion',           initials: 'N',  monthlyCost: toBaseUnits('24.90'), type: 'software', category: 'productivity' },
  { vendor: 'Slack',            initials: 'SL', monthlyCost: toBaseUnits('9.50'),  type: 'software', category: 'productivity' },
  { vendor: 'Figma',            initials: 'Fi', monthlyCost: toBaseUnits('39.90'), type: 'software', category: 'productivity' },
  { vendor: 'GitHub',           initials: 'GH', monthlyCost: toBaseUnits('21.00'), type: 'software', category: 'dev' },
  { vendor: 'Linear',           initials: 'Li', monthlyCost: toBaseUnits('16.00'), type: 'software', category: 'dev' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(app)/dashboard/serviceCatalog.test.ts"`
Expected: PASS (3 tests).

---

### Task 3: `ServiceCatalog` component

**Files:**
- Create: `apps/web/src/app/(app)/dashboard/ServiceCatalog.tsx`
- Test: `apps/web/src/app/(app)/dashboard/ServiceCatalog.test.tsx`

**Interfaces:**
- Consumes: `Toggle` (Task 1), `SERVICE_CATALOG`/`CatalogService` (Task 2), `Badge` + `SegmentedControl` design-system primitives, `createApi` (`@/lib/api`), `usePrivy`, `useRouter` (`next/navigation`), `formatUsdc` (`@/lib/money`), `getErrorMessage` (`@/lib/errors`), `useIsMobile` (`@/lib/useIsMobile`), `Bill` (`@yield2pay/shared`).
- Produces: `export default function ServiceCatalog(props: ServiceCatalogProps)` where
  `ServiceCatalogProps = { bills: Bill[]; spendable: string; category: string; onBillsChanged: () => void }`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/app/(app)/dashboard/ServiceCatalog.test.tsx`:
```tsx
/**
 * ServiceCatalog.test.tsx
 * Behavior tests for the backend-wired service catalog.
 * Mocks @/lib/api, @privy-io/react-auth, next/navigation — no real network.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockCreateBill = vi.fn();
const mockDeleteBill = vi.fn();
const mockPush = vi.fn();

vi.mock('@/lib/api', () => ({
  createApi: () => ({ createBill: mockCreateBill, deleteBill: mockDeleteBill }),
}));
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'mock-token' }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => '/dashboard',
}));

import ServiceCatalog from './ServiceCatalog';
import type { Bill } from '@yield2pay/shared';

// 100.00 USDC of headroom — affords any single catalog service.
const RICH = '1000000000';

function setup(props: Partial<React.ComponentProps<typeof ServiceCatalog>> = {}) {
  mockCreateBill.mockResolvedValue({ id: 'new', vendor: 'x', monthlyCost: '0', type: 'software', status: 'active' });
  mockDeleteBill.mockResolvedValue(undefined);
  const onBillsChanged = vi.fn();
  const view = render(
    <ServiceCatalog
      bills={props.bills ?? []}
      spendable={props.spendable ?? RICH}
      category={props.category ?? 'all'}
      onBillsChanged={props.onBillsChanged ?? onBillsChanged}
    />,
  );
  return { onBillsChanged, ...view };
}

describe('ServiceCatalog', () => {
  beforeEach(() => {
    mockCreateBill.mockReset();
    mockDeleteBill.mockReset();
    mockPush.mockReset();
  });

  it('renders catalog service cards', () => {
    setup();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Notion')).toBeInTheDocument();
    expect(screen.getByText('Linear')).toBeInTheDocument();
  });

  it('activating an affordable service calls createBill then onBillsChanged', async () => {
    const { onBillsChanged } = setup({ spendable: RICH, bills: [] });
    fireEvent.click(screen.getByRole('switch', { name: 'Slack' }));
    await waitFor(() => {
      expect(mockCreateBill).toHaveBeenCalledWith({
        vendor: 'Slack',
        monthlyCost: '95000000', // toBaseUnits('9.50')
        type: 'software',
      });
    });
    await waitFor(() => expect(onBillsChanged).toHaveBeenCalledTimes(1));
  });

  it('an active service shows On and deactivating calls deleteBill', async () => {
    const bills: Bill[] = [
      { id: 'b1', vendor: 'OpenAI', monthlyCost: '499000000', type: 'software', status: 'active' },
    ];
    const { onBillsChanged } = setup({ bills, spendable: RICH });
    const sw = screen.getByRole('switch', { name: 'OpenAI' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(sw);
    await waitFor(() => expect(mockDeleteBill).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(onBillsChanged).toHaveBeenCalledTimes(1));
  });

  it('an unaffordable inactive service is disabled and offers Increase deposit', () => {
    setup({ spendable: '0', bills: [] });
    expect(screen.getByRole('switch', { name: 'OpenAI' })).toBeDisabled();
    expect(screen.getAllByText(/increase deposit/i).length).toBeGreaterThan(0);
  });

  it('routes to /deposit when Increase deposit is clicked', () => {
    setup({ spendable: '0', bills: [] });
    fireEvent.click(screen.getAllByRole('button', { name: /increase deposit/i })[0]);
    expect(mockPush).toHaveBeenCalledWith('/deposit');
  });

  it('filters cards by category', () => {
    setup({ category: 'ai' });
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.queryByText('Notion')).not.toBeInTheDocument();
  });

  it('lists active bills (including custom vendors outside the catalog)', () => {
    const bills: Bill[] = [
      { id: 'b9', vendor: 'Electricity', monthlyCost: '5000000', type: 'utility', status: 'active' },
    ];
    setup({ bills, spendable: RICH });
    expect(screen.getByText('Electricity')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove electricity/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/(app)/dashboard/ServiceCatalog.test.tsx"`
Expected: FAIL — cannot resolve `./ServiceCatalog`.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/app/(app)/dashboard/ServiceCatalog.tsx`:
```tsx
'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { createApi } from '@/lib/api';
import { formatUsdc } from '@/lib/money';
import { getErrorMessage } from '@/lib/errors';
import { useIsMobile } from '@/lib/useIsMobile';
import { Badge } from '@/components/Badge';
import { Toggle } from '@/components/Toggle';
import type { Bill } from '@yield2pay/shared';
import { SERVICE_CATALOG } from './serviceCatalog';

export interface ServiceCatalogProps {
  /** Bills owned by the parent (dashboard). */
  bills: Bill[];
  /** Available monthly returns in USDC base units. '0' when not loaded. */
  spendable: string;
  /** Active category filter: 'all' | 'ai' | 'productivity' | 'dev'. */
  category: string;
  /** Called after a successful create/delete so the parent can refetch. */
  onBillsChanged: () => void;
}

const mono = "'Geist Mono', monospace";

export default function ServiceCatalog({ bills, spendable, category, onBillsChanged }: ServiceCatalogProps) {
  const { getAccessToken } = usePrivy();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  const router = useRouter();
  const isMobile = useIsMobile();

  const [pendingVendor, setPendingVendor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Headroom = available returns minus what is already committed to bills.
  const committed = useMemo(
    () => bills.reduce((sum, b) => sum + BigInt(b.monthlyCost), BigInt(0)),
    [bills],
  );
  const headroom = BigInt(spendable || '0') - committed;

  const visible = useMemo(
    () => SERVICE_CATALOG.filter((s) => category === 'all' || s.category === category),
    [category],
  );

  async function handleToggle(vendor: string, monthlyCost: string, type: Bill['type']) {
    setPendingVendor(vendor);
    setError(null);
    try {
      const existing = bills.find((b) => b.vendor === vendor);
      if (existing) await api.deleteBill(existing.id);
      else await api.createBill({ vendor, monthlyCost, type });
      onBillsChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update service'));
    } finally {
      setPendingVendor(null);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await api.deleteBill(id);
      onBillsChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove service'));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(220,50,50,.08)',
            border: '1px solid rgba(220,50,50,.25)',
            borderRadius: 'var(--fx-radius-md)',
            fontFamily: mono,
            fontSize: 13,
            color: '#ff6b6b',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Catalog grid ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {visible.map((svc) => {
          const activeBill = bills.find((b) => b.vendor === svc.vendor);
          const isActive = !!activeBill;
          const affordable = BigInt(svc.monthlyCost) <= headroom;
          const disabled = (!isActive && !affordable) || pendingVendor === svc.vendor;
          const dim = !isActive && !affordable;

          return (
            <div
              key={svc.vendor}
              style={{
                position: 'relative',
                background: 'var(--fx-surface-1)',
                borderRadius: 'var(--fx-radius-xl)',
                padding: 22,
                border: isActive ? '1px solid var(--fx-border-metal)' : '1px solid var(--fx-border)',
                boxShadow: isActive ? '0 0 0 1px var(--fx-selection-bg), 0 14px 34px rgba(0,0,0,.35)' : 'none',
                opacity: dim ? 0.5 : 1,
                transition: 'opacity var(--fx-dur-fast) var(--fx-ease)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 'var(--fx-radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--fx-metal)',
                    border: '1px solid var(--fx-border-metal)',
                    fontFamily: mono,
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--fx-silver-bright)',
                  }}
                >
                  {svc.initials}
                </span>
                {isActive && <Badge dot>Active</Badge>}
              </div>

              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fx-text-strong)', marginTop: 16 }}>
                {svc.vendor}
              </div>
              <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--fx-text-2)', marginTop: 4 }}>
                ${formatUsdc(svc.monthlyCost)}/mo
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: dim ? 'var(--fx-text-2)' : 'var(--fx-silver)' }}>
                  {isActive ? 'On' : affordable ? 'Activate' : 'Needs more capital'}
                </span>
                <Toggle
                  checked={isActive}
                  disabled={disabled}
                  onChange={() => handleToggle(svc.vendor, svc.monthlyCost, svc.type)}
                  aria-label={svc.vendor}
                />
              </div>

              {dim && (
                <button
                  type="button"
                  onClick={() => router.push('/deposit')}
                  style={{
                    marginTop: 12,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: mono,
                    fontSize: 11.5,
                    letterSpacing: '.04em',
                    color: 'var(--fx-silver)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  Increase deposit
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Active services list ─────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--fx-surface-1)',
          border: '1px solid var(--fx-border)',
          borderRadius: 'var(--fx-radius-xl)',
          padding: 26,
        }}
      >
        <h3
          style={{
            fontFamily: mono,
            fontSize: 11,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--fx-text-2)',
            margin: '0 0 18px',
          }}
        >
          Your active services
        </h3>

        {bills.length === 0 && (
          <p style={{ color: 'var(--fx-text-2)', fontSize: 14 }}>No active services yet. Activate one above.</p>
        )}

        {bills.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {bills.map((bill, i) => (
              <div
                key={bill.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 0',
                  borderBottom: i < bills.length - 1 ? '1px solid var(--fx-border)' : 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 'var(--fx-radius-md)',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--fx-metal)',
                      border: '1px solid var(--fx-border-metal)',
                      fontFamily: mono,
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--fx-silver-bright)',
                    }}
                  >
                    {bill.vendor.slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--fx-text-strong)' }}>
                    {bill.vendor}
                  </span>
                </span>

                <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <span style={{ fontFamily: mono, fontSize: 14, color: 'var(--fx-silver)' }}>
                    ${formatUsdc(bill.monthlyCost)}/mo
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${bill.vendor}`}
                    onClick={() => handleRemove(bill.id)}
                    style={{
                      background: 'rgba(220,50,50,.08)',
                      border: '1px solid rgba(220,50,50,.2)',
                      borderRadius: 'var(--fx-radius-sm)',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontFamily: mono,
                      fontSize: 12,
                      color: '#ff8080',
                    }}
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/(app)/dashboard/ServiceCatalog.test.tsx"`
Expected: PASS (7 tests).

---

### Task 4: Wire into the dashboard page + remove `Bills`

**Files:**
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx` (i18n `tabs` keys + `servicesTitle`/`servicesSub`, `tabOrder`, swap `<Bills>` → `<ServiceCatalog>` using `SegmentedControl`, drop `Bills` import + `tabBase`).
- Delete: `apps/web/src/app/(app)/dashboard/Bills.tsx`, `apps/web/src/app/(app)/dashboard/bills.test.tsx`.

**Interfaces:**
- Consumes: `ServiceCatalog` default export (Task 3), `SegmentedControl` (`@/components/SegmentedControl`).
- Produces: nothing new (page-level wiring).

- [ ] **Step 1: Update the EN i18n strings**

In `apps/web/src/app/(app)/dashboard/page.tsx`, EN dictionary, replace:
```ts
    servicesTitle: 'Registered subscriptions',
    servicesSub: 'Bills covered by your returns.',
    tabs: { all: 'All', software: 'Software', utility: 'Utility', other: 'Other' },
```
with:
```ts
    servicesTitle: 'Available services',
    servicesSub: 'Activate the tools your returns can cover.',
    tabs: { all: 'All', ai: 'AI tools', productivity: 'Productivity', dev: 'Dev' },
```

- [ ] **Step 2: Update the PT i18n strings**

In the PT dictionary, replace:
```ts
    servicesTitle: 'Assinaturas registradas',
    servicesSub: 'Contas cobertas pelo seu rendimento.',
    tabs: { all: 'Todos', software: 'Software', utility: 'Utilidade', other: 'Outros' },
```
with:
```ts
    servicesTitle: 'Serviços disponíveis',
    servicesSub: 'Ative as ferramentas que seu rendimento cobre.',
    tabs: { all: 'Todos', ai: 'IA', productivity: 'Produtividade', dev: 'Dev' },
```

- [ ] **Step 3: Swap the import**

Replace:
```ts
import Bills from './Bills';
```
with:
```ts
import ServiceCatalog from './ServiceCatalog';
import { SegmentedControl } from '@/components/SegmentedControl';
```

- [ ] **Step 4: Update `tabOrder` and remove `tabBase`**

Replace the `tabOrder` array (`{ id: 'all'... }` through `{ id: 'other'... }`) with:
```ts
  const tabOrder: Array<{ id: string; label: string }> = [
    { id: 'all', label: t.tabs.all },
    { id: 'ai', label: t.tabs.ai },
    { id: 'productivity', label: t.tabs.productivity },
    { id: 'dev', label: t.tabs.dev },
  ];
```
Then delete the now-unused `tabBase` constant block:
```ts
  const tabBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 999,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all .2s ease',
  };
```

- [ ] **Step 5: Replace the category tab markup with `SegmentedControl`**

Replace the hand-rolled tabs block:
```tsx
              {/* Category tabs */}
              <div
                style={{
                  display: 'inline-flex',
                  border: '1px solid #2A2D31',
                  borderRadius: 999,
                  padding: 3,
                  gap: 2,
                  background: '#16181B',
                }}
              >
                {tabOrder.map(({ id, label }) => {
                  const on = tab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      style={{
                        ...tabBase,
                        background: on ? '#2E3136' : 'transparent',
                        color: on ? '#F2F3F4' : '#9A9DA1',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
```
with:
```tsx
              {/* Category tabs */}
              <SegmentedControl
                options={tabOrder.map(({ id, label }) => ({ value: id, label }))}
                value={tab}
                onChange={setTab}
                size="sm"
              />
```

- [ ] **Step 6: Swap the component**

Replace:
```tsx
            {/* Bills management: add form + list + per-bill delete */}
            <div style={{ marginTop: 20 }}>
              <Bills bills={bills} onBillsChanged={handleBillsChanged} tab={tab} />
            </div>
```
with:
```tsx
            {/* Service catalog: activate platforms; active list below */}
            <div style={{ marginTop: 20 }}>
              <ServiceCatalog
                bills={bills}
                spendable={dashboard?.spendable ?? '0'}
                category={tab}
                onBillsChanged={handleBillsChanged}
              />
            </div>
```

- [ ] **Step 7: Delete the old component + its test**

Run:
```bash
rm "apps/web/src/app/(app)/dashboard/Bills.tsx" "apps/web/src/app/(app)/dashboard/bills.test.tsx"
```

- [ ] **Step 8: Typecheck + full dashboard test run**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: no errors (confirms no dangling `Bills`/`tabBase`/`t.tabs.software` references).

Run: `npx vitest run "src/app/(app)/dashboard"`
Expected: PASS — `serviceCatalog`, `ServiceCatalog`, and `dashboard` suites green. `dashboard.test.tsx` needs no change: its `OpenAI` assertion is still satisfied (catalog card + active list), and committed/spendable stats are computed in `page.tsx`, untouched.

- [ ] **Step 9: If `dashboard.test.tsx` fails, reconcile**

Only if Step 8 shows a red `dashboard.test.tsx`: read the failure and adjust the specific assertion (e.g. a value now rendered in more places → switch `getByText` to `getAllByText(...).length`). Do not weaken unrelated assertions.

---

### Task 5: Full verification

- [ ] **Step 1: Run the whole web test suite**

Run (from `apps/web`): `npx vitest run`
Expected: all suites PASS. Confirms no other file imported `Bills` or relied on the old `tabs` keys.

- [ ] **Step 2: Lint/build sanity (optional but recommended)**

Run (from `apps/web`): `npx next lint` (if configured) or `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Grouped commit — ONLY when the user asks**

Per `CLAUDE.md`, do not commit autonomously. When the user requests it, stage the whole feature and commit once (no co-author trailer):
```bash
git add apps/web/src/components/Toggle.tsx apps/web/src/components/Toggle.test.tsx \
  "apps/web/src/app/(app)/dashboard/serviceCatalog.ts" \
  "apps/web/src/app/(app)/dashboard/serviceCatalog.test.ts" \
  "apps/web/src/app/(app)/dashboard/ServiceCatalog.tsx" \
  "apps/web/src/app/(app)/dashboard/ServiceCatalog.test.tsx" \
  "apps/web/src/app/(app)/dashboard/page.tsx"
git add -A "apps/web/src/app/(app)/dashboard/Bills.tsx" "apps/web/src/app/(app)/dashboard/bills.test.tsx"
git commit -m "feat(web): replace bill form with backend-wired service catalog"
```

---

## Self-Review

**Spec coverage:**
- Catalog constant + 8 services + USDC prices → Task 2. ✓
- `ServiceCatalog` component, per-card states, gating math, mutations, active list → Task 3. ✓
- `Toggle` / `Badge` / `SegmentedControl` design-system alignment → Tasks 1, 3, 4. ✓
- page.tsx tabs (all/ai/productivity/dev) + header copy (en+pt) + component swap → Task 4. ✓
- Delete `Bills.tsx` + `bills.test.tsx` → Task 4. ✓
- Tests (affordable→create, active→delete, unaffordable→disabled+deposit, filter, active list, error) → Task 3 (error path exercised via `getErrorMessage` in `handleToggle`; create/delete/route covered explicitly). ✓

**Placeholder scan:** none — every step ships full code/commands.

**Type consistency:** `ServiceCatalogProps { bills, spendable, category, onBillsChanged }` consistent across Task 3 source/test and Task 4 call site. `CatalogService.monthlyCost: string` matches `createBill`'s `CreateBillDto.monthlyCost: string`. `Toggle` prop names (`checked`/`onChange`/`disabled`) consistent Task 1 ↔ Task 3. `tabs` keys (`all/ai/productivity/dev`) consistent between i18n (Steps 1-2) and `tabOrder` (Step 4).
