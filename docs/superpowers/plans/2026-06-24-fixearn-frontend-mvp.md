# FixEarn Frontend MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js web app that lets a company log in with Privy (invisible Stellar embedded wallet), deposit USDC into the DeFindex vault by signing the backend-built transaction, see its capital / accrued yield ("spendable") / APY on a dashboard, register recurring bills, and withdraw — consuming the existing `apps/api` backend.

**Architecture:** Next.js 15 App Router (`apps/web`) in the existing pnpm monorepo. Privy (`@privy-io/react-auth` + `/extended-chains`) handles auth and the Stellar embedded wallet client-side. The backend builds unsigned XDR and returns the hash to sign; the app signs it with Privy `signRawHash` and posts the signature back — the app never sees a private key. A typed fetch client attaches the Privy access token as a Bearer and speaks the shared DTOs from `@fixearn/shared`. The visual layer ports the existing brushed-metal design system (CSS tokens in `design/tokens/` + React primitives in `design/components/`).

**Tech Stack:** TypeScript (strict), Next.js 15 (App Router), React 19, `@privy-io/react-auth`, `@fixearn/shared`, Vitest + React Testing Library + `@testing-library/jest-dom` for unit/component tests. Styling: plain CSS + the existing `--fx-*` custom-property tokens (NO Tailwind — the design system is token/CSS-var based; matching it faithfully is the requirement).

## Global Constraints

- **TypeScript strict** everywhere (`strict: true`).
- **Monorepo:** app lives in `apps/web`, named `@fixearn/web`; reuses `@fixearn/shared` for API types via the same workspace mechanism `apps/api` uses.
- **Non-custodial:** the app NEVER handles a private key. Signing is exclusively via Privy `signRawHash`. No seed/secret is ever stored, logged, or passed to the backend.
- **Money display:** all money from the API is **USDC base units (7 decimals) as decimal strings**. Never parse to JS `number` for precision-sensitive math; format for display via a dedicated `formatUsdc` helper (integer/fraction split on the string). Amounts sent to the API are base-unit decimal strings too.
- **Backend contract (from `apps/api`, all JSON, Bearer Privy token required except none are public here):**
  - `POST /wallet` body `{ stellarAddress }` → `{ stellarAddress }`
  - `POST /deposit/build` body `{ amount: string }` → `{ xdr, hash }`
  - `POST /deposit/submit` body `{ xdr, signatureHex, stellarAddress, amount }` → `{ txHash }`
  - `POST /withdraw/build` / `POST /withdraw/submit` — same shapes as deposit
  - `GET /dashboard` → `{ vaultValue, principal, spendable, apyPercent }` (all strings)
  - `POST /bills` body `{ vendor, monthlyCost, type }` → bill; `GET /bills` → bill[]; `DELETE /bills/:id`
- **Privy Stellar specifics:** wallet creation via `useCreateWallet({ chainType: 'stellar' })` from `@privy-io/react-auth/extended-chains`; signing via `signRawHash({ address, chainType: 'stellar', hash })` (hash is the `0x`-prefixed hex the backend returns). Access token via `getAccessToken()` from `usePrivy()`.
- **Design fidelity — EXACT reproduction of `design/reference/` (hard requirement):** the screens MUST be **visually identical** to the canonical references in `design/reference/`. These `.dc.html` files (inline-styled, per the `design/docs/GUIA-IA-TELAS.md` format) are the single source of truth — NOT the `ui_kits/` (those are secondary). Reproduce each reference's **markup structure, inline styles, exact hex values, spacing, typography, and the `<helmet>` CSS** (brushed-metal `.brushed`, `.sweep`, `.msheen`, `.btn-shine`, keyframes) verbatim in JSX. Swap ONLY the dynamic parts for React: state, event handlers, and data from the API. Keep each reference's built-in **EN/PT dictionary** (`en`/`pt` in `renderVals()`) as the i18n source. Do not redesign, "improve", or substitute components — match pixel-for-pixel.
- **Canonical screen → route map (`design/reference/`):**
  - `FixEarn.dc.html` → `/` landing (nav: How it works / Services / Why FixEarn; hero with light-sweep).
  - `FixEarn Auth.dc.html` → `/login` (state `mode: 'login' | 'signup'` toggle; password show/hide eye).
  - `FixEarn Dashboard Cliente.dc.html` → `/dashboard` (state `nav: 'overview'`, subscription `tab` categories; capital/returns/spendable/APY + subscriptions list).
  - `FixEarn-App.html` (bundled) → integrated reference for the deposit/app flow and cross-screen nav; use it to confirm transitions and the deposit screens.
- **Tokens / primitives are a means, not the spec:** the `--fx-*` tokens in `design/tokens/*.css` and primitives in `design/components/` may be used to DRY repeated markup, but the rendered result must equal the reference. Where the reference uses a literal inline style, reproducing it literally is acceptable and preferred over forcing a primitive that drifts from the reference.
- **Per-screen fidelity gate:** each screen task ends with a visual check — render the React route and compare side-by-side against the reference `.dc.html` opened in a browser (the reference runs via `design/support.js`). Use the Playwright MCP to screenshot both and diff layout/spacing/color. Flag any visible deviation as a fix before the task is done. (Deferred to when the app can run locally; note it explicitly if skipped.)
- **Secrets:** `NEXT_PUBLIC_PRIVY_APP_ID` and `NEXT_PUBLIC_API_BASE_URL` via env; no secret keys in the frontend (Privy app secret stays server-side in `apps/api`).

---

## File Structure

```
apps/web/
  package.json                      # @fixearn/web
  next.config.ts
  tsconfig.json                     # strict; @fixearn/shared path alias
  vitest.config.ts
  test/setup.ts                     # jest-dom + env
  .env.local.example                # NEXT_PUBLIC_PRIVY_APP_ID, NEXT_PUBLIC_API_BASE_URL
  src/
    app/
      layout.tsx                    # root: fonts, <Providers>, global css
      globals.css                   # imports design tokens + base resets
      page.tsx                      # landing (public)
      login/page.tsx                # auth screen
      (app)/                        # authenticated group
        layout.tsx                  # AuthGate + Header/nav
        deposit/page.tsx            # 3-step onboarding/deposit
        dashboard/page.tsx          # capital / returns / spendable / apy / bills
        withdraw/page.tsx           # withdraw flow
    providers/
      Providers.tsx                 # PrivyProvider (client) + config
      AuthGate.tsx                  # redirects unauth → /login; provisions wallet
    lib/
      api.ts                        # typed fetch client (attaches Privy token)
      money.ts                      # formatUsdc / toBaseUnits helpers
      useStellarTx.ts               # build → signRawHash → submit hook
      useWallet.ts                  # provision Stellar embedded wallet + register
      i18n.ts                       # en/pt dictionary + useLang
    components/                     # ported design primitives
      Button.tsx MetalCard.tsx StatPanel.tsx Eyebrow.tsx Badge.tsx
      Input.tsx Select.tsx Switch.tsx SegmentedControl.tsx ProgressBar.tsx
      StatTile.tsx Header.tsx Footer.tsx
  src/**/*.test.ts(x)               # colocated tests
```

---

## Task 1: Scaffold `apps/web` + design tokens + Vitest

**Files:**
- Create: `apps/web/package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `test/setup.ts`, `.env.local.example`
- Create: `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/app/page.tsx`
- Create: `apps/web/src/lib/money.ts`
- Test: `apps/web/src/lib/money.test.ts`

**Interfaces:**
- Produces: a bootable Next app; `formatUsdc(baseUnits: string): string` (e.g. `'1075000'` → `'0.1075000'`? NO — see test: 7 decimals, so `'10750000'` → `'1.075'`) and `toBaseUnits(human: string): string`.

- [ ] **Step 1: Scaffold Next + workspace wiring**

Run:
```bash
cd apps && pnpm create next-app@latest web --ts --app --no-tailwind --eslint --src-dir --import-alias "@/*" --use-pnpm
```
Set `"name": "@fixearn/web"` in `apps/web/package.json`. Add `@fixearn/shared` as `workspace:*`. Add the `@fixearn/shared` path alias to `apps/web/tsconfig.json` (`"@fixearn/shared": ["../../packages/shared/src"]`). Add deps:
```bash
pnpm --filter @fixearn/web add @privy-io/react-auth
pnpm --filter @fixearn/web add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Vitest config + setup**

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'], globals: true },
  resolve: { alias: { '@fixearn/shared': new URL('../../packages/shared/src', import.meta.url).pathname } },
});
```
(Add `@vitejs/plugin-react` to devDeps.) `apps/web/test/setup.ts`: `import '@testing-library/jest-dom';`. Add `"test": "vitest run"` to `apps/web/package.json` scripts.

- [ ] **Step 3: Write the failing money test**

`apps/web/src/lib/money.test.ts`:
```ts
import { formatUsdc, toBaseUnits } from './money';

describe('formatUsdc (7 decimals)', () => {
  it('formats whole + fraction, trimming trailing zeros', () => {
    expect(formatUsdc('10750000')).toBe('1.075');     // 1.0750000 → 1.075
  });
  it('formats sub-unit values', () => {
    expect(formatUsdc('75000')).toBe('0.0075');        // 0.0075000
  });
  it('formats zero', () => {
    expect(formatUsdc('0')).toBe('0');
  });
  it('formats large values without precision loss', () => {
    expect(formatUsdc('9000000000000')).toBe('900000');
  });
});

describe('toBaseUnits', () => {
  it('converts a human USDC string to 7-decimal base units', () => {
    expect(toBaseUnits('1.075')).toBe('10750000');
    expect(toBaseUnits('900000')).toBe('9000000000000');
  });
  it('rejects more than 7 decimal places', () => {
    expect(() => toBaseUnits('1.12345678')).toThrow();
  });
});
```

- [ ] **Step 4: Run it, verify it fails**

Run: `pnpm --filter @fixearn/web test -- money`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement `money.ts` (string math, no float)**

```ts
const DECIMALS = 7;

export function formatUsdc(baseUnits: string): string {
  const neg = baseUnits.startsWith('-');
  const digits = (neg ? baseUnits.slice(1) : baseUnits).padStart(DECIMALS + 1, '0');
  const whole = digits.slice(0, digits.length - DECIMALS);
  let frac = digits.slice(digits.length - DECIMALS).replace(/0+$/, '');
  const out = frac ? `${whole}.${frac}` : whole;
  return neg ? `-${out}` : out;
}

export function toBaseUnits(human: string): string {
  if (!/^\d+(\.\d+)?$/.test(human)) throw new Error('invalid amount');
  const [whole, frac = ''] = human.split('.');
  if (frac.length > DECIMALS) throw new Error('too many decimals');
  const base = whole + frac.padEnd(DECIMALS, '0');
  return BigInt(base).toString(); // normalizes leading zeros
}
```

- [ ] **Step 6: Run it, verify it passes**

Run: `pnpm --filter @fixearn/web test -- money`
Expected: PASS.

- [ ] **Step 7: Tokens + global css + minimal landing**

`apps/web/src/app/globals.css`: `@import` the design tokens (copy `design/tokens/*.css` into `apps/web/src/app/tokens/` or reference them) and add the body reset + the full `<helmet>` CSS block from `design/docs/GUIA-IA-TELAS.md` / the reference files (`background: var(--fx-bg)`, Hanken Grotesk + Geist Mono fonts, `.brushed`/`.sweep`/`.msheen`/`.btn-shine` classes and their keyframes) — this is shared by every reference screen, so it belongs in `globals.css` verbatim. `layout.tsx` loads the fonts and imports `globals.css`. `page.tsx` is a temporary placeholder here; **Task 10 reproduces the real landing from `design/reference/FixEarn.dc.html` exactly.**

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold next web app + design tokens + money helpers"
```

---

> **Scope note for screens vs primitives:** the canonical screens (landing, auth, dashboard, deposit) are reproduced VERBATIM from `design/reference/` — markup + inline styles + hex — not assembled from these primitives. Extract a primitive only when the same markup repeats across screens AND the extraction renders identically to the reference. Net-new UI not present in any reference (e.g. the bills add-form, withdraw amount entry) is built with primitives + tokens in the same visual language.

## Task 2: Port design primitives as React components

**Files:**
- Create: `apps/web/src/components/{Button,MetalCard,StatPanel,Eyebrow,Badge,Input,SegmentedControl,ProgressBar,StatTile,Header}.tsx`
- Test: `apps/web/src/components/Button.test.tsx`, `apps/web/src/components/StatTile.test.tsx`

**Interfaces:**
- Consumes: the `--fx-*` tokens.
- Produces: typed React components mirroring `design/components/*` props. `Button` ({variant: 'chrome'|'ghost', onClick, children, disabled}); `StatTile` ({label, value, hint?}); `MetalCard` (wrapper with brushed surface + hover sheen); `ProgressBar` ({value: 0..1}); etc.

- [ ] **Step 1: Write failing component tests**

`apps/web/src/components/Button.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

it('renders label and fires onClick', async () => {
  const onClick = vi.fn();
  render(<Button variant="chrome" onClick={onClick}>Get started</Button>);
  await userEvent.click(screen.getByRole('button', { name: 'Get started' }));
  expect(onClick).toHaveBeenCalledOnce();
});

it('does not fire when disabled', async () => {
  const onClick = vi.fn();
  render(<Button variant="ghost" onClick={onClick} disabled>X</Button>);
  await userEvent.click(screen.getByRole('button'));
  expect(onClick).not.toHaveBeenCalled();
});
```
`apps/web/src/components/StatTile.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { StatTile } from './StatTile';
it('shows label and value', () => {
  render(<StatTile label="CAPITAL WORKING" value="$1.075" hint="USDC" />);
  expect(screen.getByText('CAPITAL WORKING')).toBeInTheDocument();
  expect(screen.getByText('$1.075')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm --filter @fixearn/web test -- components` → FAIL.

- [ ] **Step 3: Implement primitives**

Port each from `design/components/<name>/<Name>.jsx`, converting to `.tsx` with typed props (the `.d.ts` files already define the prop types — use them). Replace any inline literal colors with the `--fx-*` token vars. Keep the brushed-metal/sheen effect classes in `globals.css`. Each component is a small focused file.

- [ ] **Step 4: Run, verify pass** — `pnpm --filter @fixearn/web test -- components` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: port design-system primitives to react"
```

---

## Task 3: Privy provider + i18n

**Files:**
- Create: `apps/web/src/providers/Providers.tsx`, `apps/web/src/lib/i18n.ts`
- Modify: `apps/web/src/app/layout.tsx` (wrap children in `<Providers>`)
- Test: `apps/web/src/lib/i18n.test.ts`

**Interfaces:**
- Produces: `<Providers>` client component wrapping `PrivyProvider` configured with `appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID` and embedded-wallet/login settings; `useLang()` + `t(key)` from a typed en/pt dictionary.

- [ ] **Step 1: Failing i18n test**

`apps/web/src/lib/i18n.test.ts`:
```ts
import { dict } from './i18n';
it('has matching keys in en and pt', () => {
  expect(Object.keys(dict.en).sort()).toEqual(Object.keys(dict.pt).sort());
});
it('translates a known key', () => {
  expect(dict.pt.getStarted).toBe('Começar');
  expect(dict.en.getStarted).toBe('Get started');
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement i18n + Providers**

`i18n.ts`: export `dict = { en: {...}, pt: {...} }` (seed keys from the prototypes' dictionaries) and a `useLang` hook (React context, default `'en'`). `Providers.tsx` (`'use client'`):
```tsx
'use client';
import { PrivyProvider } from '@privy-io/react-auth';
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: { theme: 'dark', accentColor: '#C0C2C5' },
        embeddedWallets: { createOnLogin: 'off' }, // we create the Stellar wallet explicitly
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```
Wrap `children` in `layout.tsx`.

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat: privy provider + en/pt i18n"`

---

## Task 4: Typed API client (Privy-token Bearer)

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `@fixearn/shared` types, a token-getter `() => Promise<string|null>`.
- Produces: `createApi(getToken)` returning `{ registerWallet, buildDeposit, submitDeposit, buildWithdraw, submitWithdraw, getDashboard, listBills, createBill, deleteBill }`, each calling the right endpoint with the Bearer header and typed body/response. Throws `ApiError` on non-2xx.

- [ ] **Step 1: Failing test (fetch mocked)**

`apps/web/src/lib/api.test.ts`:
```ts
import { createApi, ApiError } from './api';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body } as any);
}

it('attaches bearer token and posts deposit build', async () => {
  const f = mockFetch(200, { xdr: 'X', hash: '0xh' });
  vi.stubGlobal('fetch', f);
  const api = createApi(async () => 'tok123');
  const res = await api.buildDeposit('10750000');
  expect(res).toEqual({ xdr: 'X', hash: '0xh' });
  const [url, init] = f.mock.calls[0];
  expect(String(url)).toMatch(/\/deposit\/build$/);
  expect(init.headers.Authorization).toBe('Bearer tok123');
  expect(JSON.parse(init.body)).toEqual({ amount: '10750000' });
});

it('throws ApiError on non-2xx', async () => {
  vi.stubGlobal('fetch', mockFetch(401, { message: 'no' }));
  const api = createApi(async () => null);
  await expect(api.getDashboard()).rejects.toBeInstanceOf(ApiError);
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement `api.ts`**

A `request` helper reads `NEXT_PUBLIC_API_BASE_URL`, calls `getToken()`, sets `Authorization: Bearer <token>` (when present) + `Content-Type: application/json`, throws `ApiError(status, body)` on `!ok`, returns typed JSON. Each method is a thin typed wrapper using the `@fixearn/shared` DTOs.

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat: typed api client with privy bearer auth"`

---

## Task 5: Wallet provisioning + AuthGate + register

**Files:**
- Create: `apps/web/src/lib/useWallet.ts`, `apps/web/src/providers/AuthGate.tsx`, `apps/web/src/app/(app)/layout.tsx`, `apps/web/src/app/login/page.tsx`
- Test: `apps/web/src/lib/useWallet.test.tsx`

**Interfaces:**
- Consumes: Privy `usePrivy`, `useCreateWallet` (extended-chains), the api client.
- Produces: `useWallet()` → `{ address: string|null, ensureWallet(): Promise<string> }` that returns the existing Stellar embedded wallet address or creates one via `useCreateWallet({ chainType: 'stellar' })`, then calls `api.registerWallet(address)` (idempotent). `AuthGate` redirects unauthenticated users to `/login` and calls `ensureWallet()` once authenticated. `(app)/layout.tsx` wraps authed pages in `AuthGate` + `Header`.

- [ ] **Step 1: Failing test for ensureWallet**

`apps/web/src/lib/useWallet.test.tsx` — render a tiny component using the hook with mocked Privy (`usePrivy` returns a user with a stellar wallet, or none) and a mocked api; assert: (a) when a stellar wallet exists, `ensureWallet` returns its address and calls `registerWallet` once; (b) when none exists, it calls `createWallet({chainType:'stellar'})` then registers. (Mock `@privy-io/react-auth` and `/extended-chains` modules with `vi.mock`.)

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement `useWallet` + `AuthGate` + `(app)/layout` + `/login`**

`useWallet`: read `user.linkedAccounts` for a `chainType==='stellar'` embedded wallet; if missing call `createWallet`. After obtaining the address, `await api.registerWallet({ stellarAddress: address })` (backend upserts, so idempotent). `AuthGate` (`'use client'`): `const { ready, authenticated } = usePrivy()`; redirect to `/login` when `ready && !authenticated`; when authenticated, call `ensureWallet()` in an effect (once).

`/login/page.tsx` — **reproduce `design/reference/FixEarn Auth.dc.html` EXACTLY**: the centered brushed-metal auth card, the `mode: 'login' | 'signup'` segmented toggle, the email/password inputs with the password show/hide eye icon (the two eye SVGs are in the reference), the chrome submit button, and the EN/PT dictionary from the reference. Wire the submit/login action to Privy `login()` (replace the prototype's mock auth), keep the `mode` toggle as React state. Match markup, inline styles, and hex to the reference.

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat: stellar wallet provisioning + auth gate + login"`

---

## Task 6: `useStellarTx` — build → sign → submit

**Files:**
- Create: `apps/web/src/lib/useStellarTx.ts`
- Test: `apps/web/src/lib/useStellarTx.test.tsx`

**Interfaces:**
- Consumes: the api client, Privy `signRawHash` (extended-chains), `useWallet`.
- Produces: `useStellarTx()` → `{ deposit(amountBaseUnits: string): Promise<string /*txHash*/>, withdraw(amountBaseUnits: string): Promise<string> }`. `deposit` flow: `ensureWallet()` → `api.buildDeposit(amount)` → `signRawHash({ address, chainType:'stellar', hash })` → `api.submitDeposit({ xdr, signatureHex: signature, stellarAddress: address, amount })` → return `txHash`. `withdraw` mirrors it.

- [ ] **Step 1: Failing test wiring the full chain (all mocked)**

`useStellarTx.test.tsx`: mock api (`buildDeposit` → `{xdr:'X', hash:'0xh'}`, `submitDeposit` → `{txHash:'TX'}`), mock `signRawHash` → `{ signature: '0xsig' }`, mock `useWallet` → address `'GADDR'`. Assert `deposit('10750000')` returns `'TX'` and that `submitDeposit` was called with `{ xdr:'X', signatureHex:'0xsig', stellarAddress:'GADDR', amount:'10750000' }`. Add the same for `withdraw`.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement `useStellarTx`** exactly per the Interfaces flow above; surface errors (let them throw to the caller for the UI to catch).

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat: useStellarTx build-sign-submit hook"`

---

## Task 7: Deposit onboarding flow (3 steps)

**Files:**
- Create: `apps/web/src/app/(app)/deposit/page.tsx`, plus any local step components
- Test: `apps/web/src/app/(app)/deposit/deposit.test.tsx`

**Interfaces:**
- Consumes: `useStellarTx`, `toBaseUnits`, `formatUsdc`, primitives, i18n.
- Produces: a 3-step flow mirroring `design/ui_kits/fixearn-deposit` — (1) enter amount with a live returns projection, (2) review, (3) confirm → calls `deposit(toBaseUnits(amount))`, shows the resulting txHash / success. Validates the amount client-side (positive, ≤7 decimals) before enabling continue.

- [ ] **Step 1: Failing component test**

`deposit.test.tsx`: render with `useStellarTx` mocked; type an amount, advance steps, click confirm, assert `deposit` was called with the base-unit string (`toBaseUnits` applied) and a success state renders the returned txHash. Also assert an invalid amount (`'1.123456789'`) disables/blocks continue.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement the flow** — **reproduce the deposit screens EXACTLY** from `design/reference/FixEarn-App.html` (the bundled app contains the 3-step deposit/onboarding; cross-check against `design/ui_kits/fixearn-deposit` for the same composition). Match markup, inline styles, hex, the step indicator/progress, and the live returns projection. Wire only the confirm action to `useStellarTx().deposit` and the amount field to React state. Keep the reference's EN/PT strings.

- [ ] **Step 4b: Fidelity check** — render `/deposit` and screenshot it via the Playwright MCP; open `design/reference/FixEarn-App.html` (served so `design/support.js` loads) to the deposit screen and screenshot; compare layout/spacing/color. Fix any visible deviation. (If the app can't run yet, note this check as deferred.)

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat: 3-step deposit onboarding flow"`

---

## Task 8: Dashboard

**Files:**
- Create: `apps/web/src/app/(app)/dashboard/page.tsx`
- Test: `apps/web/src/app/(app)/dashboard/dashboard.test.tsx`

**Interfaces:**
- Consumes: `api.getDashboard`, `api.listBills`, `formatUsdc`, primitives, i18n.
- Produces: the logged-in overview (port `design/ui_kits/fixearn-dashboard`): capital working (`vaultValue`), accrued returns (`vaultValue − principal` = `spendable`), spendable "software credit", APY, and the list of registered bills. Money rendered via `formatUsdc`. Loads on mount; shows loading + error states.

- [ ] **Step 1: Failing component test**

`dashboard.test.tsx`: mock `api.getDashboard` → `{ vaultValue:'10750000', principal:'10000000', spendable:'750000', apyPercent:'7.50' }` and `api.listBills` → `[{ id:'b1', vendor:'OpenAI', monthlyCost:'2000000', type:'software', status:'active' }]`. Assert the screen shows `formatUsdc('10750000')` (`'1.075'`), the spendable `'0.075'`, `7.50%`, and the bill vendor `OpenAI`.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement the dashboard** — **reproduce `design/reference/FixEarn Dashboard Cliente.dc.html` EXACTLY**: the sidebar/nav (`nav: 'overview'` state), the capital/returns/spendable stat panels, the APY, and the subscriptions list with its category tabs (`tab` state; the reference seeds openai/claude/etc.). Match markup, inline styles, hex, spacing. Then wire the LIVE data: replace the prototype's hardcoded numbers with `formatUsdc(...)` of `GET /dashboard` (`vaultValue`/`principal`/`spendable`/`apyPercent`) and the subscriptions list with `GET /bills`. Keep `nav`/`tab` as React state and the EN/PT dictionary.

- [ ] **Step 3b: Fidelity check** — screenshot `/dashboard` (with mocked API data matching the reference's sample values) via the Playwright MCP and compare against `design/reference/FixEarn Dashboard Cliente.dc.html` opened in a browser; fix visible deviations. (Defer with a note if the app can't run yet.)

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat: dashboard (capital, returns, spendable, apy, bills)"`

---

## Task 9: Bills management + Withdraw

**Files:**
- Create: `apps/web/src/app/(app)/dashboard/Bills.tsx` (or a bills section), `apps/web/src/app/(app)/withdraw/page.tsx`
- Test: `apps/web/src/app/(app)/dashboard/bills.test.tsx`, `apps/web/src/app/(app)/withdraw/withdraw.test.tsx`

**Interfaces:**
- Consumes: `api.createBill/listBills/deleteBill`, `useStellarTx.withdraw`, `toBaseUnits`, primitives.
- Produces: a bills section to add (vendor, monthlyCost via `toBaseUnits`, type select software/utility/other), list, and delete; and a withdraw page entering an amount → `withdraw(toBaseUnits(amount))` → success/txHash. Software is the default bill type (software-first).

- [ ] **Step 1: Failing tests**

`bills.test.tsx`: mock api; fill the form (vendor `OpenAI`, cost `2`, type defaults `software`), submit, assert `createBill` called with `{ vendor:'OpenAI', monthlyCost:'20000000', type:'software' }`; click delete on a listed bill, assert `deleteBill('b1')`. `withdraw.test.tsx`: mock `useStellarTx`; enter amount, confirm, assert `withdraw` called with base-unit string and success renders txHash.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement** bills section + withdraw page, wiring to the api/hook. Default the bill type select to `software`.

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit** — `git commit -m "feat: bills management + withdraw flow"`

---

## Task 10: Landing page (exact reproduction)

**Files:**
- Modify: `apps/web/src/app/page.tsx` (replace the Task 1 placeholder)
- Create: any local landing sections
- Test: `apps/web/src/app/landing.test.tsx`

**Interfaces:**
- Consumes: tokens, helmet CSS, i18n, Privy `login` (CTA), primitives where they render identically.
- Produces: the public marketing landing, **visually identical to `design/reference/FixEarn.dc.html`** — header nav (How it works / Services / Why FixEarn), the hero (`h-title` clamp typography) with the looping light-sweep, the section blocks, footer, and the EN/PT toggle. The primary CTA ("Get started" / "Começar") routes to `/login` (Privy `login()`).

- [ ] **Step 1: Failing smoke/structure test**

`apps/web/src/app/landing.test.tsx`: render the landing; assert the eyebrow `BANKING, REINVENTED FOR SOFTWARE`, the nav labels (`How it works`, `Services`, `Why FixEarn`), and the hero CTA are present; assert clicking the CTA triggers the login/route action (mock it).

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement the landing** — reproduce `design/reference/FixEarn.dc.html` VERBATIM in JSX: copy the template markup, inline styles, exact hex, the `.sweep` hero animation, and the en/pt dictionary. Convert the `support.js`/DCLogic dynamic bits (lang toggle, intersection-reveal) to React (`useState` for `lang`, `IntersectionObserver` in an effect for the reveal). Only the CTA action changes (→ Privy login / `/login`).

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Fidelity check** — screenshot `/` via the Playwright MCP and compare against `design/reference/FixEarn.dc.html` opened in a browser; fix visible deviations. (Defer with a note if the app can't run yet.)

- [ ] **Step 6: Commit** — `git commit -m "feat: landing page (exact reproduction of reference)"`

---

## Out of scope (this plan)

- Real Privy app + on-chain testnet wiring (needs `NEXT_PUBLIC_PRIVY_APP_ID` + a running backend with credentials) — manual/e2e verification deferred, same as the backend's integration tests.
- Playwright e2e against the live stack — add once credentials exist.
- Fiat ramp / payment-engine UI — fase 2.

---

## Self-Review

**Spec coverage:**
- Next.js + React + TS, Privy embedded Stellar wallet (invisible to user) → Tasks 1, 3, 5. ✓
- Non-custodial signing via `signRawHash` only → Task 6. ✓
- Deposit → DeFindex (via backend build/submit) → Tasks 6, 7. ✓
- Dashboard: capital, returns, spendable, APY, bills → Task 8. ✓
- Bills generic with software-first default → Task 9. ✓
- Withdraw (principal withdrawable) → Task 9. ✓
- Design fidelity — screens EXACTLY reproduce `design/reference/` (`.dc.html`): landing → Task 10, auth → Task 5, dashboard → Task 8, deposit → Task 7; shared helmet CSS/tokens → Task 1; EN/PT from each reference's own dictionary. Per-screen visual fidelity gate via Playwright MCP. ✓
- Money as base-unit strings, no float → Task 1 (`money.ts`), used throughout. ✓
- API contract matches `apps/api` endpoints/DTOs → Task 4. ✓

**Open verification points (deferred, same rationale as backend):**
1. Privy `useCreateWallet`/`signRawHash` exact runtime shapes on the installed `@privy-io/react-auth` version — pin when wiring a real Privy app id (Tasks 5, 6 mock them).
2. End-to-end deposit against the live backend + testnet — deferred to manual/e2e once credentials exist.

**Type consistency:** all API calls use `@fixearn/shared` DTOs (`BuildTxResponse`, `SubmitTxDto`, `SpendableView`, `CreateBillDto`, `BillType`) — same package the backend produces, so the contract can't drift. `formatUsdc`/`toBaseUnits` operate on strings end-to-end.
