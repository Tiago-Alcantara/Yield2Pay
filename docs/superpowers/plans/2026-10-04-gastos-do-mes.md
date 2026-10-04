# Gastos do Mês Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one authenticated API module and one family screen that records this month's household spending in BRL centavos, from a saved recurring account or from a São Paulo NFC-e QR.

**Architecture:** A new `gastos` Nest module, guarded by the existing `AuthGuard`, scopes every row to `req.companyId`. A recurring account stores only a name and an amount; it becomes a `MonthExpense` row when the person confirms "já gastei", and a unique key blocks a second row in the same America/Sao_Paulo month. A receipt screen reads the QR in the browser, the API extracts the 44-digit access key and, only for cUF 35, GETs the official SEFAZ-SP QR page; the row is inserted only on confirm. The screen is a client page at `/family/gastos`, outside venue.

**Tech Stack:** NestJS 11, Prisma 7 + PostgreSQL, class-validator, Vitest, Next.js App Router client page, `@privy-io/react-auth`, existing `createApi`.

## Global Constraints

- No blockchain, no Open Finance, no payment, no debit, no due date, no reminder, no user-created categories.
- New API module and one web screen, outside venue. Do not edit `venues/`, `apps/api/src/venue/`, `apps/api/src/stellar/`, Solana venue code, or the Expo app.
- One month-expense table: amount, merchant, date, source (`conta` or `nota`), category chosen at confirmation.
- Fixed categories only: `mercado`, `conta_da_casa`, `transporte`, `outros`.
- Money is BRL centavos (integer), not USDC.
- Tenant is Company via the existing auth guard (`AuthGuard` sets `req.companyId`).
- Recurring account: name and amount saved once. It becomes a month row only when the person taps "já gastei". A second tap in the same month must not create a second row.
- Receipt: camera reads the QR, extract the 44-digit NFC-e access key, consult the public NFC-e page for the UF. First UF is São Paulo, cUF 35. Timezone is `America/Sao_Paulo`.
- Show merchant, amount, and date, and save only after confirmation, including the category.
- If the consult fails or the UF is not SP, the three fields stay editable and the access key is still stored on confirm.
- Screen lives with the family app at `/family/gastos`. List the current month: amount, merchant, date.
- Do not reuse `RecurringBill`. That model is USDC software subscriptions in 7-decimal base units (`monthlyCost BigInt`). Do not add columns to it, do not write gastos through `BillsService`, and do not store centavos in `recurring_bills`.
- Amounts are JSON numbers of centavos (`17119` means R$ 171,19), never USDC base-unit strings and never `parseBaseUnits`.
- SEFAZ-SP production URLs, read from https://portal.fazenda.sp.gov.br/servicos/nfce/Paginas/WebServices.aspx on 2026-10-04: QR page `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx` and short URL `https://www.nfce.fazenda.sp.gov.br/qrcode` (the short URL 302s to the QR page). Consult by GET on the long URL. Do not call the typed-key page `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaPublica.aspx`: on 2026-10-04 it requires the image captcha `ctl00$Conteudo$ctlCaptcha$txCodigo`.
- A `p` value that is only the 44 digits is rejected by SEFAZ-SP with "Formato de QR-Code não suportado" (checked 2026-10-04). Replay the full QR `p` parameter (`chave|...`). Never fetch the host that happened to be printed in the QR; always rebuild the SEFAZ-SP URL above.
- On a successful SP page (checked 2026-10-04) the merchant is the text of `#u20`, the amount is the `#totalNota` span `totalNumb txtMax` after the label `Valor a pagar R$:`, and the date is the `dd/mm/yyyy` after `Emissão:`.
- Tests: API `pnpm exec vitest run <path>` from `apps/api` (globals are on; specs match `src/**/*.spec.ts`). Web `pnpm exec vitest run <path>` from `apps/web`.
- `apps/web/AGENTS.md`: this Next.js is not the one in training data. This plan only adds a `'use client'` page, the same kind as `apps/web/src/app/family/deposito/page.tsx`. Do not introduce new framework APIs.
- Commit per task. No `Co-Authored-By` trailer.

## File Structure

- `packages/shared/src/index.ts` — gastos DTOs and view types appended beside the existing bill types.
- `apps/api/src/gastos/centavos.ts` — reject anything that is not an integer number of centavos.
- `apps/api/src/gastos/sao-paulo-month.ts` — calendar month and today's date in `America/Sao_Paulo`.
- `apps/api/src/gastos/nfce-qr.ts` — 44-digit key, cUF, and the full `p` parameter.
- `apps/api/src/gastos/nfce-sp.ts` — official URL and HTML parse for merchant, amount, date.
- `apps/api/src/gastos/create-conta.body.ts` — `POST /gastos/contas` body.
- `apps/api/src/gastos/ja-gastei.body.ts` — category body for "já gastei".
- `apps/api/src/gastos/consultar-nota.body.ts` — raw QR text.
- `apps/api/src/gastos/confirm-nota.body.ts` — confirmed receipt fields.
- `apps/api/src/gastos/gastos.service.ts` — company-scoped persistence and the SEFAZ consult.
- `apps/api/src/gastos/gastos.controller.ts` — `AuthGuard` + `req.companyId`.
- `apps/api/src/gastos/gastos.module.ts` — imports `AuthModule` only.
- `apps/api/src/app.module.ts` — register `GastosModule`.
- `apps/api/prisma/schema.prisma` — `RecurringAccount` and `MonthExpense` only. Leave `RecurringBill` as it is.
- `apps/api/prisma/migrations/20261004180000_gastos_do_mes/migration.sql` — tables, enums, FKs.
- `apps/api/src/company/company.service.ts` — delete the new child rows inside the existing account-delete transaction so the company FK still works.
- `apps/web/src/lib/api.ts` — six client methods.
- `apps/web/src/app/family/gastos/format.ts` — centavos and date display, plus reais input → centavos.
- `apps/web/src/app/family/gastos/scanQr.ts` — camera QR text. No network.
- `apps/web/src/app/family/gastos/page.tsx` — the only new screen.
- `apps/web/src/app/family/_components/DashboardHeader.tsx` — link to `/family/gastos`.
- `apps/web/src/app/family/_lib/familyI18n.ts` — label for that link.
- Each `*.spec.ts` / `*.test.ts` sits next to the file it tests.

---

### Task 1: Centavos and the São Paulo month

**Files:**
- Modify: `packages/shared/src/index.ts` (append at end)
- Create: `apps/api/src/gastos/centavos.ts`
- Test: `apps/api/src/gastos/centavos.spec.ts`
- Create: `apps/api/src/gastos/sao-paulo-month.ts`
- Test: `apps/api/src/gastos/sao-paulo-month.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ExpenseSource = 'conta' | 'nota'`
  - `ExpenseCategory = 'mercado' | 'conta_da_casa' | 'transporte' | 'outros'`
  - `CreateContaDto = { name: string; amountCents: number }`
  - `RecurringAccountView = { id: string; name: string; amountCents: number; spentThisMonth: boolean }`
  - `JaGasteiDto = { category: ExpenseCategory }`
  - `ConsultarNotaDto = { qrText: string }`
  - `NotaConsultaView = { accessKey: string; cUf: string; ufSupported: boolean; consultOk: boolean; merchant: string | null; amountCents: number | null; spentOn: string | null }`
  - `ConfirmNotaDto = { accessKey: string; merchant: string; amountCents: number; spentOn: string; category: ExpenseCategory }`
  - `MonthExpenseView = { id: string; amountCents: number; merchant: string; spentOn: string; source: ExpenseSource; category: ExpenseCategory }`
  - `MonthExpensesView = { month: string; expenses: MonthExpenseView[] }`
  - `spentOn` and `NotaConsultaView.spentOn` are `YYYY-MM-DD`. `MonthExpensesView.month` is `YYYY-MM`.
  - `parseCentavos(value: unknown): number` throws `BadRequestException` unless `value` is an integer from 1 through 2147483647.
  - `saoPauloYearMonth(now?: Date): string`
  - `saoPauloTodayDate(now?: Date): Date` — UTC midnight of today's calendar date in `America/Sao_Paulo`, for a Prisma `@db.Date`.
  - `monthRange(yearMonth: string): { start: Date; end: Date }` — `start` inclusive, `end` exclusive, both UTC midnights.

- [ ] **Step 1: Write the failing test**

`apps/api/src/gastos/centavos.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { parseCentavos } from './centavos';

it('accepts a positive centavos integer', () => {
  expect(parseCentavos(17119)).toBe(17119);
});

it('rejects USDC-style strings, zero, fractions, and values above int4', () => {
  for (const bad of ['17119', 0, -1, 1.5, 2147483648, null]) {
    expect(() => parseCentavos(bad)).toThrow(BadRequestException);
  }
});
```

`apps/api/src/gastos/sao-paulo-month.spec.ts`:

```ts
import { monthRange, saoPauloTodayDate, saoPauloYearMonth } from './sao-paulo-month';

it('keeps 2026-10-01T02:30Z in September because São Paulo is still on the 30th', () => {
  const instant = new Date('2026-10-01T02:30:00.000Z');
  expect(saoPauloYearMonth(instant)).toBe('2026-09');
  expect(saoPauloTodayDate(instant).toISOString()).toBe('2026-09-30T00:00:00.000Z');
});

it('rolls the month at 2026-10-01T03:00Z', () => {
  const instant = new Date('2026-10-01T03:00:00.000Z');
  expect(saoPauloYearMonth(instant)).toBe('2026-10');
  expect(saoPauloTodayDate(instant).toISOString()).toBe('2026-10-01T00:00:00.000Z');
});

it('returns a half-open UTC range for a calendar month', () => {
  expect(monthRange('2026-10')).toEqual({
    start: new Date('2026-10-01T00:00:00.000Z'),
    end: new Date('2026-11-01T00:00:00.000Z'),
  });
});
```

Append to `packages/shared/src/index.ts` (the test for this task does not import it; later tasks do):

```ts
export type ExpenseSource = 'conta' | 'nota';
export type ExpenseCategory = 'mercado' | 'conta_da_casa' | 'transporte' | 'outros';

export interface CreateContaDto {
  name: string;
  amountCents: number;
}
export interface RecurringAccountView {
  id: string;
  name: string;
  amountCents: number;
  spentThisMonth: boolean;
}
export interface JaGasteiDto {
  category: ExpenseCategory;
}
export interface ConsultarNotaDto {
  qrText: string;
}
export interface NotaConsultaView {
  accessKey: string;
  cUf: string;
  ufSupported: boolean;
  consultOk: boolean;
  merchant: string | null;
  amountCents: number | null;
  spentOn: string | null;
}
export interface ConfirmNotaDto {
  accessKey: string;
  merchant: string;
  amountCents: number;
  spentOn: string;
  category: ExpenseCategory;
}
export interface MonthExpenseView {
  id: string;
  amountCents: number;
  merchant: string;
  spentOn: string;
  source: ExpenseSource;
  category: ExpenseCategory;
}
export interface MonthExpensesView {
  month: string;
  expenses: MonthExpenseView[];
}
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/api`: `pnpm exec vitest run src/gastos/centavos.spec.ts src/gastos/sao-paulo-month.spec.ts`

Expected: FAIL — cannot find `./centavos` and `./sao-paulo-month`.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/gastos/centavos.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

const MAX_CENTAVOS = 2_147_483_647;

/** Integer BRL centavos. Not a USDC base-unit string. */
export function parseCentavos(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new BadRequestException('amountCents must be an integer number of BRL centavos');
  }
  if (value < 1 || value > MAX_CENTAVOS) {
    throw new BadRequestException('amountCents must be between 1 and 2147483647');
  }
  return value;
}
```

`apps/api/src/gastos/sao-paulo-month.ts`:

```ts
const TZ = 'America/Sao_Paulo';

function parts(now: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const bag = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return { year: Number(bag.year), month: Number(bag.month), day: Number(bag.day) };
}

export function saoPauloYearMonth(now: Date = new Date()): string {
  const p = parts(now);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

export function saoPauloTodayDate(now: Date = new Date()): Date {
  const p = parts(now);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

export function monthRange(yearMonth: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) throw new Error(`bad yearMonth ${yearMonth}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `apps/api`: `pnpm exec vitest run src/gastos/centavos.spec.ts src/gastos/sao-paulo-month.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts apps/api/src/gastos/centavos.ts apps/api/src/gastos/centavos.spec.ts apps/api/src/gastos/sao-paulo-month.ts apps/api/src/gastos/sao-paulo-month.spec.ts
git commit -m "feat: add centavos and São Paulo month helpers for gastos"
```

---

### Task 2: Extract the NFC-e access key from the QR

**Files:**
- Create: `apps/api/src/gastos/nfce-qr.ts`
- Test: `apps/api/src/gastos/nfce-qr.spec.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `parseNfceQr(qrText: string): { accessKey: string; cUf: string; p: string | null }`.
  - `accessKey` is 44 digits. `cUf` is `accessKey.slice(0, 2)`.
  - `p` is the full query value (everything after `p=`), or `null` when the payload is only the 44 digits.
  - Throws `BadRequestException` when no 44-digit key is present.

- [ ] **Step 1: Write the failing test**

`apps/api/src/gastos/nfce-qr.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { parseNfceQr } from './nfce-qr';

const KEY = '35261000000000000191650010000000011000000013';

it('reads cUF and the full p parameter from a version 3 QR URL', () => {
  const qr = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${KEY}|3|1`;
  expect(parseNfceQr(qr)).toEqual({ accessKey: KEY, cUf: '35', p: `${KEY}|3|1` });
});

it('reads a version 2 p parameter that still includes the CSC hash', () => {
  const p = `${KEY}|2|1|1|EB6ACFA67A69E9724DE30EDCB92BBDBC964A4513`;
  const qr = `https://evil.example/qrcode?p=${p}`;
  expect(parseNfceQr(qr)).toEqual({ accessKey: KEY, cUf: '35', p });
});

it('accepts a bare 44-digit key and leaves p null', () => {
  expect(parseNfceQr(KEY)).toEqual({ accessKey: KEY, cUf: '35', p: null });
});

it('reads a non-SP cUF without deciding that the UF is supported', () => {
  const rj = `33${'0'.repeat(42)}`;
  expect(parseNfceQr(rj).cUf).toBe('33');
});

it('rejects a payload with no 44-digit key', () => {
  expect(() => parseNfceQr('https://example.com/qrcode?p=abc')).toThrow(BadRequestException);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/api`: `pnpm exec vitest run src/gastos/nfce-qr.spec.ts`

Expected: FAIL — cannot find `./nfce-qr`.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/gastos/nfce-qr.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

const KEY = /^\d{44}$/;

export function parseNfceQr(qrText: string): { accessKey: string; cUf: string; p: string | null } {
  const text = qrText.trim();
  let accessKey: string | null = null;
  let p: string | null = null;
  try {
    const raw = new URL(text).searchParams.get('p');
    if (raw) {
      p = raw;
      const first = raw.split('|')[0] ?? '';
      if (KEY.test(first)) accessKey = first;
    }
  } catch {
    // Not a URL. Fall through to a bare key.
  }
  if (!accessKey) {
    const match = text.match(/(?:^|\D)(\d{44})(?:\D|$)/);
    if (match) accessKey = match[1];
  }
  if (!accessKey) {
    throw new BadRequestException('qr does not contain a 44-digit NFC-e access key');
  }
  return { accessKey, cUf: accessKey.slice(0, 2), p };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `apps/api`: `pnpm exec vitest run src/gastos/nfce-qr.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gastos/nfce-qr.ts apps/api/src/gastos/nfce-qr.spec.ts
git commit -m "feat: extract the NFC-e access key from a QR payload"
```

---

### Task 3: Parse the SEFAZ-SP public QR page

**Files:**
- Create: `apps/api/src/gastos/nfce-sp.ts`
- Test: `apps/api/src/gastos/nfce-sp.spec.ts`

**Interfaces:**
- Consumes: nothing from Task 2. The service in Task 7 calls both.
- Produces:
  - `SEFAZ_SP_QR_PAGE = 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx'`
  - `sefazSpConsultUrl(p: string): string` — that constant plus `?p=` and `encodeURIComponent(p)`. Throws `BadRequestException` unless `p` matches `/^\d{44}\|/` and its length is 46 through 300.
  - `parseNfceSpHtml(html: string): { merchant: string; amountCents: number; spentOn: string }`
  - `fetchNfceSpPage(p: string, fetchImpl?: typeof fetch): Promise<string>` — GET the rebuilt URL, follow redirects, 8s timeout. Throws `BadRequestException` on a non-OK response.

- [ ] **Step 1: Write the failing test**

`apps/api/src/gastos/nfce-sp.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { fetchNfceSpPage, parseNfceSpHtml, sefazSpConsultUrl } from './nfce-sp';

const HTML = `
<div id="u20" class="txtTopo">MERCADO EXEMPLO LTDA</div>
<div id="totalNota">
  <label>Valor a pagar R$:</label>
  <span class="totalNumb txtMax">1.234,56</span>
</div>
<strong> Emissão: </strong>14/03/2019 19:59:14
`;

it('rebuilds only the official SEFAZ-SP QR page', () => {
  const p = `${'3'.repeat(44)}|3|1`;
  expect(sefazSpConsultUrl(p)).toBe(
    `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${encodeURIComponent(p)}`,
  );
});

it('rejects a bare 44-digit p and a p that does not start with the key', () => {
  expect(() => sefazSpConsultUrl('3'.repeat(44))).toThrow(BadRequestException);
  expect(() => sefazSpConsultUrl('not-a-key|3|1')).toThrow(BadRequestException);
});

it('reads merchant, centavos, and the calendar date from the public page', () => {
  expect(parseNfceSpHtml(HTML)).toEqual({
    merchant: 'MERCADO EXEMPLO LTDA',
    amountCents: 123456,
    spentOn: '2019-03-14',
  });
});

it('treats the SEFAZ error dialog as a failed consult', () => {
  const bad = `${HTML}<script>$('#spnErroProsseguirMaster').html('Problemas na consulta via QR Code');</script>`;
  expect(() => parseNfceSpHtml(bad)).toThrow(BadRequestException);
});

it('fetches the rebuilt URL and returns the body', async () => {
  const p = `${'3'.repeat(44)}|3|1`;
  const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: async () => HTML });
  await expect(fetchNfceSpPage(p, fetchImpl as unknown as typeof fetch)).resolves.toBe(HTML);
  expect(fetchImpl).toHaveBeenCalledWith(sefazSpConsultUrl(p), expect.objectContaining({ method: 'GET' }));
  const called = String(fetchImpl.mock.calls[0][0]);
  expect(called.startsWith('https://www.nfce.fazenda.sp.gov.br/')).toBe(true);
  expect(called.includes('evil.example')).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/api`: `pnpm exec vitest run src/gastos/nfce-sp.spec.ts`

Expected: FAIL — cannot find `./nfce-sp`.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/gastos/nfce-sp.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

export const SEFAZ_SP_QR_PAGE =
  'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx';

export function sefazSpConsultUrl(p: string): string {
  if (p.length < 46 || p.length > 300 || !/^\d{44}\|/.test(p)) {
    throw new BadRequestException('qr p parameter must be the full SEFAZ value starting with the 44-digit key');
  }
  return `${SEFAZ_SP_QR_PAGE}?p=${encodeURIComponent(p)}`;
}

function one(html: string, re: RegExp): string | null {
  const match = re.exec(html);
  return match ? match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : null;
}

function brlToCentavos(raw: string): number {
  if (!/^\d{1,3}(\.\d{3})*,\d{2}$/.test(raw) && !/^\d+,\d{2}$/.test(raw)) {
    throw new BadRequestException('sefaz-sp amount is not BRL');
  }
  const [reais, cents] = raw.replace(/\./g, '').split(',');
  return Number(reais) * 100 + Number(cents);
}

export function parseNfceSpHtml(html: string): { merchant: string; amountCents: number; spentOn: string } {
  if (/Problemas na consulta/i.test(html)) {
    throw new BadRequestException('sefaz-sp consult failed');
  }
  const merchant = one(html, /<div id="u20"[^>]*>([^<]+)<\/div>/i);
  const amountRaw = one(html, /Valor a pagar R\$:<\/label>\s*<span class="totalNumb txtMax">([^<]+)<\/span>/i);
  const dateRaw = one(html, /Emissão:\s*<\/strong>\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (!merchant || !amountRaw || !dateRaw) {
    throw new BadRequestException('sefaz-sp page missing merchant, amount, or date');
  }
  const [day, month, year] = dateRaw.split('/');
  return {
    merchant,
    amountCents: brlToCentavos(amountRaw),
    spentOn: `${year}-${month}-${day}`,
  };
}

export async function fetchNfceSpPage(p: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(sefazSpConsultUrl(p), {
    method: 'GET',
    redirect: 'follow',
    headers: { Accept: 'text/html' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new BadRequestException(`sefaz-sp http ${response.status}`);
  return response.text();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `apps/api`: `pnpm exec vitest run src/gastos/nfce-sp.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gastos/nfce-sp.ts apps/api/src/gastos/nfce-sp.spec.ts
git commit -m "feat: parse the SEFAZ-SP public NFC-e page"
```

---

### Task 4: Month expense and recurring account tables

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261004180000_gastos_do_mes/migration.sql`
- Modify: `apps/api/src/company/company.service.ts` (the `deleteAccount` transaction)
- Test: `apps/api/src/gastos/schema.spec.ts`
- Modify: `apps/api/src/company/company.service.spec.ts` (the delete test around the child-row transaction)

**Interfaces:**
- Consumes: category and source names from Task 1.
- Produces Prisma models `RecurringAccount` and `MonthExpense`, delegates `prisma.recurringAccount` and `prisma.monthExpense`.
  - `RecurringAccount`: `id`, `companyId`, `name`, `amountCents Int`, `createdAt`. Mapped to `recurring_accounts`.
  - `MonthExpense`: `id`, `companyId`, `amountCents Int`, `merchant`, `spentOn DateTime @db.Date`, `source ExpenseSource`, `category ExpenseCategory`, `accessKey String?`, `recurringAccountId String?`, `yearMonth String?`, `createdAt`. Mapped to `month_expenses`.
  - `@@unique([companyId, recurringAccountId, yearMonth])` and `@@unique([companyId, accessKey])`. PostgreSQL unique constraints treat NULL as distinct, so many `nota` rows (null account, null access key on `conta` rows) are allowed, and the same account cannot be inserted twice for one `yearMonth`.
  - `Company` gains `recurringAccounts RecurringAccount[]` and `monthExpenses MonthExpense[]` only.
  - `RecurringBill` stays `monthlyCost BigInt` with the comment `USDC amount in base units (7 decimal places)`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/gastos/schema.spec.ts`:

```ts
import { readFileSync } from 'node:fs';

function block(schema: string, model: string): string {
  const rest = schema.split(`model ${model}`)[1];
  if (!rest) throw new Error(`missing ${model}`);
  return rest.split(/\nmodel /)[0];
}

it('adds BRL centavo tables and leaves RecurringBill on USDC', () => {
  const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
  const bill = block(schema, 'RecurringBill');
  expect(bill).toContain('USDC amount in base units (7 decimal places)');
  expect(bill).toContain('monthlyCost BigInt');
  const account = block(schema, 'RecurringAccount');
  expect(account).toContain('amountCents Int');
  expect(account).toContain('@@map("recurring_accounts")');
  const expense = block(schema, 'MonthExpense');
  expect(expense).toContain('amountCents Int');
  expect(expense).toContain('source ExpenseSource');
  expect(expense).toContain('category ExpenseCategory');
  expect(expense).toContain('spentOn DateTime @map("spent_on") @db.Date');
  expect(expense).toContain('@@map("month_expenses")');
  expect(expense).not.toContain('monthlyCost');
});
```

In `apps/api/src/company/company.service.spec.ts`, extend the `tx` object inside `deleteAccount removes child rows then the company` with:

```ts
monthExpense: { deleteMany: vi.fn() },
recurringAccount: { deleteMany: vi.fn() },
```

and after `await svc.deleteAccount('co_1')` add:

```ts
expect(tx.monthExpense.deleteMany).toHaveBeenCalledWith({ where: { companyId: 'co_1' } });
expect(tx.recurringAccount.deleteMany).toHaveBeenCalledWith({ where: { companyId: 'co_1' } });
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/api`: `pnpm exec vitest run src/gastos/schema.spec.ts src/company/company.service.spec.ts`

Expected: FAIL — `schema.spec.ts` throws `missing MonthExpense`. The company spec fails because `deleteMany` was not called.

- [ ] **Step 3: Write minimal implementation**

On `model Company`, add two relation fields. Do not change `bills RecurringBill[]`:

```prisma
  recurringAccounts RecurringAccount[]
  monthExpenses     MonthExpense[]
```

Append to `apps/api/prisma/schema.prisma`:

```prisma
enum ExpenseSource {
  conta
  nota
}

enum ExpenseCategory {
  mercado
  conta_da_casa
  transporte
  outros
}

/// Name and BRL centavos saved once. Not a month row until "já gastei".
model RecurringAccount {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  name        String
  /// BRL centavos. Not USDC base units.
  amountCents Int      @map("amount_cents")
  createdAt   DateTime @default(now()) @map("created_at")

  company  Company        @relation(fields: [companyId], references: [id])
  expenses MonthExpense[]

  @@index([companyId])
  @@map("recurring_accounts")
}

/// One household spend in a month. BRL centavos. Not a RecurringBill.
model MonthExpense {
  id                 String          @id @default(cuid())
  companyId          String          @map("company_id")
  /// BRL centavos. Not USDC base units.
  amountCents        Int             @map("amount_cents")
  merchant           String
  spentOn            DateTime        @map("spent_on") @db.Date
  source             ExpenseSource
  category           ExpenseCategory
  accessKey          String?         @map("access_key")
  recurringAccountId String?         @map("recurring_account_id")
  /// YYYY-MM in America/Sao_Paulo. Set only for source=conta.
  yearMonth          String?         @map("year_month")
  createdAt          DateTime        @default(now()) @map("created_at")

  company          Company           @relation(fields: [companyId], references: [id])
  recurringAccount RecurringAccount? @relation(fields: [recurringAccountId], references: [id])

  @@unique([companyId, recurringAccountId, yearMonth])
  @@unique([companyId, accessKey])
  @@index([companyId, spentOn])
  @@index([companyId, yearMonth])
  @@map("month_expenses")
}
```

`apps/api/prisma/migrations/20261004180000_gastos_do_mes/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('conta', 'nota');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('mercado', 'conta_da_casa', 'transporte', 'outros');

-- CreateTable
CREATE TABLE "recurring_accounts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_expenses" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "merchant" TEXT NOT NULL,
    "spent_on" DATE NOT NULL,
    "source" "ExpenseSource" NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "access_key" TEXT,
    "recurring_account_id" TEXT,
    "year_month" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "month_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_accounts_company_id_idx" ON "recurring_accounts"("company_id");

-- CreateIndex
CREATE INDEX "month_expenses_company_id_spent_on_idx" ON "month_expenses"("company_id", "spent_on");

-- CreateIndex
CREATE INDEX "month_expenses_company_id_year_month_idx" ON "month_expenses"("company_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "month_expenses_company_id_recurring_account_id_year_month_key" ON "month_expenses"("company_id", "recurring_account_id", "year_month");

-- CreateIndex
CREATE UNIQUE INDEX "month_expenses_company_id_access_key_key" ON "month_expenses"("company_id", "access_key");

-- AddForeignKey
ALTER TABLE "recurring_accounts" ADD CONSTRAINT "recurring_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_expenses" ADD CONSTRAINT "month_expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_expenses" ADD CONSTRAINT "month_expenses_recurring_account_id_fkey" FOREIGN KEY ("recurring_account_id") REFERENCES "recurring_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

In `deleteAccount`, delete the new children first inside the existing `$transaction`, before `recurringBill`:

```ts
      await tx.monthExpense.deleteMany(childWhere);
      await tx.recurringAccount.deleteMany(childWhere);
      await tx.recurringBill.deleteMany(childWhere);
```

Do not add gastos to `exportAccount`.

From `apps/api`, regenerate the client (no database required): `pnpm exec prisma generate`

- [ ] **Step 4: Run test to verify it passes**

Run from `apps/api`: `pnpm exec vitest run src/gastos/schema.spec.ts src/company/company.service.spec.ts`

Expected: PASS. `RecurringBill` specs in `src/bills` still pass: `pnpm exec vitest run src/bills/bills.service.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20261004180000_gastos_do_mes/migration.sql apps/api/src/gastos/schema.spec.ts apps/api/src/company/company.service.ts apps/api/src/company/company.service.spec.ts
git commit -m "feat: add BRL month expense tables without touching recurring bills"
```

---

### Task 5: Save a recurring account once

**Files:**
- Create: `apps/api/src/gastos/create-conta.body.ts`
- Test: `apps/api/src/gastos/create-conta.body.spec.ts`
- Create: `apps/api/src/gastos/gastos.service.ts`
- Test: `apps/api/src/gastos/gastos.service.spec.ts`
- Create: `apps/api/src/gastos/gastos.controller.ts`
- Test: `apps/api/src/gastos/gastos.controller.spec.ts`
- Create: `apps/api/src/gastos/gastos.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `CreateContaDto`, `RecurringAccountView`, `parseCentavos` from Task 1. Prisma `recurringAccount` from Task 4. `AuthGuard`, `AuthenticatedRequest`.
- Produces:
  - `CreateContaBody implements CreateContaDto`
  - `GastosService.createConta(companyId: string, dto: CreateContaDto): Promise<RecurringAccountView>`
  - `GastosService.listContas(companyId: string, now?: Date): Promise<RecurringAccountView[]>` — `spentThisMonth` is false for every row until Task 6 writes month rows. Implement the flag here anyway: it is true when a `monthExpense` exists for that `recurringAccountId` and `yearMonth === saoPauloYearMonth(now)`.
  - `POST /gastos/contas` and `GET /gastos/contas`, both `@UseGuards(AuthGuard)`, both passing `req.companyId`.
  - `GastosModule` imported from `AppModule`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/gastos/create-conta.body.spec.ts`:

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateContaBody } from './create-conta.body';

async function errorsOf(plain: Record<string, unknown>) {
  return validate(plainToInstance(CreateContaBody, plain));
}

it('accepts a name and integer centavos', async () => {
  expect(await errorsOf({ name: 'Luz', amountCents: 15000 })).toHaveLength(0);
});

it('rejects an empty name, a string amount, and zero', async () => {
  expect((await errorsOf({ name: '', amountCents: 15000 })).length).toBeGreaterThan(0);
  expect((await errorsOf({ name: 'Luz', amountCents: '15000' })).length).toBeGreaterThan(0);
  expect((await errorsOf({ name: 'Luz', amountCents: 0 })).length).toBeGreaterThan(0);
});
```

`apps/api/src/gastos/gastos.service.spec.ts`:

```ts
import { GastosService } from './gastos.service';

it('saves the account and does not create a month expense', async () => {
  const prisma = {
    recurringAccount: { create: vi.fn().mockResolvedValue({ id: 'acc_1', name: 'Luz', amountCents: 15000 }) },
    monthExpense: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  } as any;
  const svc = new GastosService(prisma);
  const row = await svc.createConta('co_1', { name: 'Luz', amountCents: 15000 });
  expect(prisma.recurringAccount.create).toHaveBeenCalledWith({
    data: { companyId: 'co_1', name: 'Luz', amountCents: 15000 },
  });
  expect(prisma.monthExpense.create).not.toHaveBeenCalled();
  expect(row).toEqual({ id: 'acc_1', name: 'Luz', amountCents: 15000, spentThisMonth: false });
});

it('lists only this company and marks an account already spent in the São Paulo month', async () => {
  const prisma = {
    recurringAccount: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'acc_1', name: 'Luz', amountCents: 15000 },
        { id: 'acc_2', name: 'Aluguel', amountCents: 200000 },
      ]),
    },
    monthExpense: {
      findMany: vi.fn().mockResolvedValue([{ recurringAccountId: 'acc_1' }]),
    },
  } as any;
  const svc = new GastosService(prisma);
  const rows = await svc.listContas('co_1', new Date('2026-10-04T15:00:00.000Z'));
  expect(prisma.recurringAccount.findMany).toHaveBeenCalledWith({
    where: { companyId: 'co_1' },
    orderBy: { createdAt: 'asc' },
  });
  expect(prisma.monthExpense.findMany).toHaveBeenCalledWith({
    where: { companyId: 'co_1', yearMonth: '2026-10', recurringAccountId: { not: null } },
    select: { recurringAccountId: true },
  });
  expect(rows.map((r) => r.spentThisMonth)).toEqual([true, false]);
});
```

`apps/api/src/gastos/gastos.controller.spec.ts`:

```ts
import { GastosController } from './gastos.controller';

it('POST /gastos/contas passes req.companyId', async () => {
  const gastos = { createConta: vi.fn().mockResolvedValue({ id: 'acc_1' }) };
  const ctrl = new GastosController(gastos as any);
  await ctrl.createConta({ companyId: 'co_1' } as any, { name: 'Luz', amountCents: 15000 });
  expect(gastos.createConta).toHaveBeenCalledWith('co_1', { name: 'Luz', amountCents: 15000 });
});

it('GET /gastos/contas passes req.companyId', async () => {
  const gastos = { listContas: vi.fn().mockResolvedValue([]) };
  const ctrl = new GastosController(gastos as any);
  await ctrl.listContas({ companyId: 'co_1' } as any);
  expect(gastos.listContas).toHaveBeenCalledWith('co_1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/api`: `pnpm exec vitest run src/gastos/create-conta.body.spec.ts src/gastos/gastos.service.spec.ts src/gastos/gastos.controller.spec.ts`

Expected: FAIL — cannot find the modules.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/gastos/create-conta.body.ts`:

```ts
import { IsInt, IsString, Length, Max, Min } from 'class-validator';
import type { CreateContaDto } from '@yield2pay/shared';

export class CreateContaBody implements CreateContaDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  amountCents!: number;
}
```

`apps/api/src/gastos/gastos.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { CreateContaDto, RecurringAccountView } from '@yield2pay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { parseCentavos } from './centavos';
import { saoPauloYearMonth } from './sao-paulo-month';

@Injectable()
export class GastosService {
  constructor(private readonly prisma: PrismaService) {}

  async createConta(companyId: string, dto: CreateContaDto): Promise<RecurringAccountView> {
    const amountCents = parseCentavos(dto.amountCents);
    const row = await this.prisma.recurringAccount.create({
      data: { companyId, name: dto.name.trim(), amountCents },
    });
    return { id: row.id, name: row.name, amountCents: row.amountCents, spentThisMonth: false };
  }

  async listContas(companyId: string, now: Date = new Date()): Promise<RecurringAccountView[]> {
    const accounts = await this.prisma.recurringAccount.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });
    const spent = await this.prisma.monthExpense.findMany({
      where: {
        companyId,
        yearMonth: saoPauloYearMonth(now),
        recurringAccountId: { not: null },
      },
      select: { recurringAccountId: true },
    });
    const spentIds = new Set(spent.map((row) => row.recurringAccountId));
    return accounts.map((row) => ({
      id: row.id,
      name: row.name,
      amountCents: row.amountCents,
      spentThisMonth: spentIds.has(row.id),
    }));
  }
}
```

`apps/api/src/gastos/gastos.controller.ts`:

```ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { CreateContaBody } from './create-conta.body';
import { GastosService } from './gastos.service';

@Controller('gastos')
@UseGuards(AuthGuard)
export class GastosController {
  constructor(private readonly gastos: GastosService) {}

  @Post('contas')
  createConta(@Req() req: AuthenticatedRequest, @Body() body: CreateContaBody) {
    return this.gastos.createConta(req.companyId, body);
  }

  @Get('contas')
  listContas(@Req() req: AuthenticatedRequest) {
    return this.gastos.listContas(req.companyId);
  }
}
```

`apps/api/src/gastos/gastos.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GastosController } from './gastos.controller';
import { GastosService } from './gastos.service';

@Module({
  imports: [AuthModule],
  providers: [GastosService],
  controllers: [GastosController],
})
export class GastosModule {}
```

In `apps/api/src/app.module.ts`, import `GastosModule` from `./gastos/gastos.module` and add it to the `imports` array next to `BillsModule`. Do not register the controller inside `BillsModule`.

- [ ] **Step 4: Run test to verify it passes**

Run from `apps/api`: `pnpm exec vitest run src/gastos/create-conta.body.spec.ts src/gastos/gastos.service.spec.ts src/gastos/gastos.controller.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gastos apps/api/src/app.module.ts
git commit -m "feat: save a recurring household account without posting a month row"
```

---

### Task 6: "já gastei" posts one row per São Paulo month

**Files:**
- Create: `apps/api/src/gastos/ja-gastei.body.ts`
- Test: `apps/api/src/gastos/ja-gastei.body.spec.ts`
- Modify: `apps/api/src/gastos/gastos.service.ts`
- Modify: `apps/api/src/gastos/gastos.service.spec.ts`
- Modify: `apps/api/src/gastos/gastos.controller.ts`
- Modify: `apps/api/src/gastos/gastos.controller.spec.ts`

**Interfaces:**
- Consumes: `JaGasteiDto`, `MonthExpenseView`, `saoPauloYearMonth`, `saoPauloTodayDate`, `GastosService` from Task 5.
- Produces: `GastosService.jaGastei(companyId: string, contaId: string, dto: JaGasteiDto, now?: Date): Promise<MonthExpenseView>`.
  - Loads the account with `{ id: contaId, companyId }`. Missing → `NotFoundException`.
  - Inserts `source: 'conta'`, `merchant` = account name, `amountCents` = saved amount, `spentOn` = `saoPauloTodayDate(now)`, `yearMonth` = `saoPauloYearMonth(now)`, `category` from the body, `accessKey: null`.
  - Prisma `P2002` → `ConflictException` with message `já lançado neste mês`. No second row.
  - `POST /gastos/contas/:id/ja-gastei` passes `req.companyId` and the path id.

- [ ] **Step 1: Write the failing test**

`apps/api/src/gastos/ja-gastei.body.spec.ts`:

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JaGasteiBody } from './ja-gastei.body';

it('accepts only the four fixed categories', async () => {
  const ok = await validate(plainToInstance(JaGasteiBody, { category: 'conta_da_casa' }));
  const bad = await validate(plainToInstance(JaGasteiBody, { category: 'escola' }));
  expect(ok).toHaveLength(0);
  expect(bad.length).toBeGreaterThan(0);
});
```

Add `import { ConflictException, NotFoundException } from '@nestjs/common';` at the top of `gastos.service.spec.ts`, then append:

```ts
it('já gastei copies the saved account into one month row', async () => {
  const prisma = {
    recurringAccount: { findFirst: vi.fn().mockResolvedValue({ id: 'acc_1', name: 'Luz', amountCents: 15000 }) },
    monthExpense: {
      create: vi.fn().mockResolvedValue({
        id: 'exp_1',
        amountCents: 15000,
        merchant: 'Luz',
        spentOn: new Date('2026-10-04T00:00:00.000Z'),
        source: 'conta',
        category: 'conta_da_casa',
      }),
    },
  } as any;
  const svc = new GastosService(prisma);
  const row = await svc.jaGastei('co_1', 'acc_1', { category: 'conta_da_casa' }, new Date('2026-10-04T15:00:00.000Z'));
  expect(prisma.recurringAccount.findFirst).toHaveBeenCalledWith({ where: { id: 'acc_1', companyId: 'co_1' } });
  expect(prisma.monthExpense.create).toHaveBeenCalledWith({
    data: {
      companyId: 'co_1',
      amountCents: 15000,
      merchant: 'Luz',
      spentOn: new Date('2026-10-04T00:00:00.000Z'),
      source: 'conta',
      category: 'conta_da_casa',
      accessKey: null,
      recurringAccountId: 'acc_1',
      yearMonth: '2026-10',
    },
  });
  expect(row.spentOn).toBe('2026-10-04');
});

it('a second tap in the same month does not create a row', async () => {
  const prisma = {
    recurringAccount: { findFirst: vi.fn().mockResolvedValue({ id: 'acc_1', name: 'Luz', amountCents: 15000 }) },
    monthExpense: { create: vi.fn().mockRejectedValue({ code: 'P2002' }) },
  } as any;
  const svc = new GastosService(prisma);
  await expect(
    svc.jaGastei('co_1', 'acc_1', { category: 'conta_da_casa' }, new Date('2026-10-04T15:00:00.000Z')),
  ).rejects.toBeInstanceOf(ConflictException);
});

it('does not spend another company account', async () => {
  const prisma = {
    recurringAccount: { findFirst: vi.fn().mockResolvedValue(null) },
    monthExpense: { create: vi.fn() },
  } as any;
  const svc = new GastosService(prisma);
  await expect(svc.jaGastei('co_1', 'acc_9', { category: 'outros' })).rejects.toBeInstanceOf(NotFoundException);
  expect(prisma.monthExpense.create).not.toHaveBeenCalled();
});
```

Append to `gastos.controller.spec.ts`:

```ts
it('POST /gastos/contas/:id/ja-gastei passes companyId and the id', async () => {
  const gastos = { jaGastei: vi.fn().mockResolvedValue({ id: 'exp_1' }) };
  const ctrl = new GastosController(gastos as any);
  await ctrl.jaGastei({ companyId: 'co_1' } as any, 'acc_1', { category: 'transporte' });
  expect(gastos.jaGastei).toHaveBeenCalledWith('co_1', 'acc_1', { category: 'transporte' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/api`: `pnpm exec vitest run src/gastos/ja-gastei.body.spec.ts src/gastos/gastos.service.spec.ts src/gastos/gastos.controller.spec.ts`

Expected: FAIL — `JaGasteiBody` and `jaGastei` are not defined.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/gastos/ja-gastei.body.ts`:

```ts
import { IsIn } from 'class-validator';
import type { ExpenseCategory, JaGasteiDto } from '@yield2pay/shared';

export class JaGasteiBody implements JaGasteiDto {
  @IsIn(['mercado', 'conta_da_casa', 'transporte', 'outros'])
  category!: ExpenseCategory;
}
```

Add to `GastosService`:

```ts
  async jaGastei(
    companyId: string,
    contaId: string,
    dto: JaGasteiDto,
    now: Date = new Date(),
  ): Promise<MonthExpenseView> {
    const account = await this.prisma.recurringAccount.findFirst({
      where: { id: contaId, companyId },
    });
    if (!account) throw new NotFoundException('conta não encontrada');
    try {
      const row = await this.prisma.monthExpense.create({
        data: {
          companyId,
          amountCents: account.amountCents,
          merchant: account.name,
          spentOn: saoPauloTodayDate(now),
          source: 'conta',
          category: dto.category,
          accessKey: null,
          recurringAccountId: account.id,
          yearMonth: saoPauloYearMonth(now),
        },
      });
      return toMonthExpenseView(row);
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
        throw new ConflictException('já lançado neste mês');
      }
      throw e;
    }
  }
```

Add the mapper in the same file:

```ts
function toMonthExpenseView(row: {
  id: string;
  amountCents: number;
  merchant: string;
  spentOn: Date;
  source: 'conta' | 'nota';
  category: 'mercado' | 'conta_da_casa' | 'transporte' | 'outros';
}): MonthExpenseView {
  return {
    id: row.id,
    amountCents: row.amountCents,
    merchant: row.merchant,
    spentOn: row.spentOn.toISOString().slice(0, 10),
    source: row.source,
    category: row.category,
  };
}
```

Import `ConflictException` and `NotFoundException` from `@nestjs/common`, and `JaGasteiDto` plus `MonthExpenseView` from `@yield2pay/shared`. Import `saoPauloTodayDate` next to `saoPauloYearMonth`.

Add to `GastosController`:

```ts
  @Post('contas/:id/ja-gastei')
  jaGastei(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: JaGasteiBody,
  ) {
    return this.gastos.jaGastei(req.companyId, id, body);
  }
```

Import `Param` and `JaGasteiBody`.

- [ ] **Step 4: Run test to verify it passes**

Run from `apps/api`: `pnpm exec vitest run src/gastos/ja-gastei.body.spec.ts src/gastos/gastos.service.spec.ts src/gastos/gastos.controller.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gastos
git commit -m "feat: post a month row once when a recurring account is marked spent"
```

---

### Task 7: Consult the NFC-e and do not save it

**Files:**
- Create: `apps/api/src/gastos/consultar-nota.body.ts`
- Test: `apps/api/src/gastos/consultar-nota.body.spec.ts`
- Modify: `apps/api/src/gastos/gastos.service.ts`
- Modify: `apps/api/src/gastos/gastos.service.spec.ts`
- Modify: `apps/api/src/gastos/gastos.controller.ts`
- Modify: `apps/api/src/gastos/gastos.controller.spec.ts`

**Interfaces:**
- Consumes: `parseNfceQr`, `fetchNfceSpPage`, `parseNfceSpHtml`, `ConsultarNotaDto`, `NotaConsultaView`.
- Produces: `GastosService.consultarNota(dto: ConsultarNotaDto, fetchImpl?: typeof fetch): Promise<NotaConsultaView>`.
  - No Prisma write.
  - `cUf !== '35'` → `ufSupported: false`, `consultOk: false`, the three fields `null`, `accessKey` set. Do not call fetch.
  - `p === null` or `p` does not start with `${accessKey}|` → same empty fields, `consultOk: false`. Do not call fetch.
  - SP with a full `p` → `fetchNfceSpPage` then `parseNfceSpHtml`. Any throw → `consultOk: false` and null fields, `accessKey` still returned.
  - `POST /gastos/notas/consultar` is behind `AuthGuard` but does not read `companyId` (the consult is not tenant data). The guard still runs so the route is not an open proxy.

- [ ] **Step 1: Write the failing test**

`apps/api/src/gastos/consultar-nota.body.spec.ts`:

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConsultarNotaBody } from './consultar-nota.body';

it('requires the raw QR text', async () => {
  const ok = await validate(plainToInstance(ConsultarNotaBody, { qrText: '3'.repeat(44) }));
  const bad = await validate(plainToInstance(ConsultarNotaBody, { qrText: 'short' }));
  expect(ok).toHaveLength(0);
  expect(bad.length).toBeGreaterThan(0);
});
```

Append to `gastos.service.spec.ts`:

```ts
const SP_KEY = '35261000000000000191650010000000011000000013';

it('does not consult SEFAZ and does not save when the UF is not SP', async () => {
  const fetchImpl = vi.fn();
  const prisma = { monthExpense: { create: vi.fn() } } as any;
  const svc = new GastosService(prisma);
  const view = await svc.consultarNota({ qrText: `33${'0'.repeat(42)}` }, fetchImpl as unknown as typeof fetch);
  expect(view).toMatchObject({ cUf: '33', ufSupported: false, consultOk: false, merchant: null, amountCents: null, spentOn: null });
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(prisma.monthExpense.create).not.toHaveBeenCalled();
});

it('does not fetch when the QR has no full p parameter', async () => {
  const fetchImpl = vi.fn();
  const svc = new GastosService({} as any);
  const view = await svc.consultarNota({ qrText: SP_KEY }, fetchImpl as unknown as typeof fetch);
  expect(view.accessKey).toBe(SP_KEY);
  expect(view.consultOk).toBe(false);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('returns merchant, centavos, and date from a SP page without saving', async () => {
  const html = `
    <div id="u20" class="txtTopo">MERCADO EXEMPLO LTDA</div>
    <div id="totalNota"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">171,19</span></div>
    <strong> Emissão: </strong>04/10/2026 12:00:00
  `;
  const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: async () => html });
  const prisma = { monthExpense: { create: vi.fn() } } as any;
  const svc = new GastosService(prisma);
  const view = await svc.consultarNota(
    { qrText: `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${SP_KEY}|3|1` },
    fetchImpl as unknown as typeof fetch,
  );
  expect(view).toMatchObject({
    accessKey: SP_KEY,
    cUf: '35',
    ufSupported: true,
    consultOk: true,
    merchant: 'MERCADO EXEMPLO LTDA',
    amountCents: 17119,
    spentOn: '2026-10-04',
  });
  expect(prisma.monthExpense.create).not.toHaveBeenCalled();
});

it('keeps the access key when the public page fails', async () => {
  const fetchImpl = vi.fn().mockRejectedValue(new Error('down'));
  const svc = new GastosService({} as any);
  const view = await svc.consultarNota(
    { qrText: `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${SP_KEY}|3|1` },
    fetchImpl as unknown as typeof fetch,
  );
  expect(view).toMatchObject({ accessKey: SP_KEY, consultOk: false, merchant: null, amountCents: null, spentOn: null });
});
```

Append to `gastos.controller.spec.ts`:

```ts
it('POST /gastos/notas/consultar does not persist', async () => {
  const gastos = { consultarNota: vi.fn().mockResolvedValue({ accessKey: '1'.repeat(44), consultOk: false }) };
  const ctrl = new GastosController(gastos as any);
  await ctrl.consultarNota({ qrText: '1'.repeat(44) });
  expect(gastos.consultarNota).toHaveBeenCalledWith({ qrText: '1'.repeat(44) });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/api`: `pnpm exec vitest run src/gastos/consultar-nota.body.spec.ts src/gastos/gastos.service.spec.ts src/gastos/gastos.controller.spec.ts`

Expected: FAIL — `consultarNota` is not a function.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/gastos/consultar-nota.body.ts`:

```ts
import { IsString, Length } from 'class-validator';
import type { ConsultarNotaDto } from '@yield2pay/shared';

export class ConsultarNotaBody implements ConsultarNotaDto {
  @IsString()
  @Length(44, 600)
  qrText!: string;
}
```

Add to `GastosService`:

```ts
  async consultarNota(dto: ConsultarNotaDto, fetchImpl: typeof fetch = fetch): Promise<NotaConsultaView> {
    const parsed = parseNfceQr(dto.qrText);
    const empty: NotaConsultaView = {
      accessKey: parsed.accessKey,
      cUf: parsed.cUf,
      ufSupported: parsed.cUf === '35',
      consultOk: false,
      merchant: null,
      amountCents: null,
      spentOn: null,
    };
    if (parsed.cUf !== '35' || !parsed.p || !parsed.p.startsWith(`${parsed.accessKey}|`)) return empty;
    try {
      const html = await fetchNfceSpPage(parsed.p, fetchImpl);
      const fields = parseNfceSpHtml(html);
      return { ...empty, consultOk: true, ...fields };
    } catch {
      return empty;
    }
  }
```

Import `NotaConsultaView` and `ConsultarNotaDto` from `@yield2pay/shared`, and `parseNfceQr` / `fetchNfceSpPage` / `parseNfceSpHtml` from the files in Tasks 2 and 3.

Add to `GastosController`:

```ts
  @Post('notas/consultar')
  consultarNota(@Body() body: ConsultarNotaBody) {
    return this.gastos.consultarNota(body);
  }
```

Declare this method before `@Post('notas')` from Task 8 so the static path is not swallowed. Nest matches the literal `notas/consultar` as its own route; still declare it first.

- [ ] **Step 4: Run test to verify it passes**

Run from `apps/api`: `pnpm exec vitest run src/gastos/consultar-nota.body.spec.ts src/gastos/gastos.service.spec.ts src/gastos/gastos.controller.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gastos
git commit -m "feat: consult a São Paulo NFC-e without saving it"
```

---

### Task 8: Confirm the receipt, including a failed consult

**Files:**
- Create: `apps/api/src/gastos/confirm-nota.body.ts`
- Test: `apps/api/src/gastos/confirm-nota.body.spec.ts`
- Modify: `apps/api/src/gastos/gastos.service.ts`
- Modify: `apps/api/src/gastos/gastos.service.spec.ts`
- Modify: `apps/api/src/gastos/gastos.controller.ts`
- Modify: `apps/api/src/gastos/gastos.controller.spec.ts`

**Interfaces:**
- Consumes: `ConfirmNotaDto`, `MonthExpenseView`, `parseCentavos`, `toMonthExpenseView`.
- Produces: `GastosService.confirmNota(companyId: string, dto: ConfirmNotaDto): Promise<MonthExpenseView>`.
  - Does not call `fetch`. Persists the body the screen already showed.
  - `source: 'nota'`, `accessKey` = the 44 digits, `recurringAccountId: null`, `yearMonth: null`.
  - `spentOn` is the `YYYY-MM-DD` from the body, stored as UTC midnight. Reject a non-date such as `2026-02-31` with `BadRequestException`.
  - `P2002` → `ConflictException` `nota já lançada`.
  - `POST /gastos/notas` passes `req.companyId`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/gastos/confirm-nota.body.spec.ts`:

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConfirmNotaBody } from './confirm-nota.body';

const KEY = '35261000000000000191650010000000011000000013';

function body(over: Record<string, unknown> = {}) {
  return plainToInstance(ConfirmNotaBody, {
    accessKey: KEY,
    merchant: 'Padaria',
    amountCents: 1990,
    spentOn: '2026-10-04',
    category: 'mercado',
    ...over,
  });
}

it('accepts a confirmed receipt', async () => {
  expect(await validate(body())).toHaveLength(0);
});

it('rejects a short key, a bad date, and an invented category', async () => {
  expect((await validate(body({ accessKey: '123' }))).length).toBeGreaterThan(0);
  expect((await validate(body({ spentOn: '04/10/2026' }))).length).toBeGreaterThan(0);
  expect((await validate(body({ category: 'lazer' }))).length).toBeGreaterThan(0);
});
```

Append to `gastos.service.spec.ts`:

```ts
it('confirmNota stores the access key and the fields the person confirmed', async () => {
  const fetchImpl = vi.fn();
  const prisma = {
    monthExpense: {
      create: vi.fn().mockResolvedValue({
        id: 'exp_2',
        amountCents: 1990,
        merchant: 'Padaria',
        spentOn: new Date('2026-10-04T00:00:00.000Z'),
        source: 'nota',
        category: 'mercado',
      }),
    },
  } as any;
  const svc = new GastosService(prisma);
  const row = await svc.confirmNota('co_1', {
    accessKey: SP_KEY,
    merchant: 'Padaria',
    amountCents: 1990,
    spentOn: '2026-10-04',
    category: 'mercado',
  });
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(prisma.monthExpense.create).toHaveBeenCalledWith({
    data: {
      companyId: 'co_1',
      amountCents: 1990,
      merchant: 'Padaria',
      spentOn: new Date('2026-10-04T00:00:00.000Z'),
      source: 'nota',
      category: 'mercado',
      accessKey: SP_KEY,
      recurringAccountId: null,
      yearMonth: null,
    },
  });
  expect(row.source).toBe('nota');
});

it('rejects a calendar-impossible date', async () => {
  const prisma = { monthExpense: { create: vi.fn() } } as any;
  const svc = new GastosService(prisma);
  await expect(
    svc.confirmNota('co_1', {
      accessKey: SP_KEY,
      merchant: 'Padaria',
      amountCents: 1990,
      spentOn: '2026-02-31',
      category: 'mercado',
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(prisma.monthExpense.create).not.toHaveBeenCalled();
});

it('does not insert the same access key twice for one company', async () => {
  const prisma = { monthExpense: { create: vi.fn().mockRejectedValue({ code: 'P2002' }) } } as any;
  const svc = new GastosService(prisma);
  await expect(
    svc.confirmNota('co_1', {
      accessKey: SP_KEY,
      merchant: 'Padaria',
      amountCents: 1990,
      spentOn: '2026-10-04',
      category: 'outros',
    }),
  ).rejects.toBeInstanceOf(ConflictException);
});
```

Add `BadRequestException` to the existing `@nestjs/common` import in the spec.

Append to `gastos.controller.spec.ts`:

```ts
it('POST /gastos/notas passes req.companyId', async () => {
  const gastos = { confirmNota: vi.fn().mockResolvedValue({ id: 'exp_2' }) };
  const ctrl = new GastosController(gastos as any);
  const dto = {
    accessKey: '3'.repeat(44),
    merchant: 'Padaria',
    amountCents: 1990,
    spentOn: '2026-10-04',
    category: 'mercado' as const,
  };
  await ctrl.confirmNota({ companyId: 'co_1' } as any, dto);
  expect(gastos.confirmNota).toHaveBeenCalledWith('co_1', dto);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/api`: `pnpm exec vitest run src/gastos/confirm-nota.body.spec.ts src/gastos/gastos.service.spec.ts src/gastos/gastos.controller.spec.ts`

Expected: FAIL — `confirmNota` is not a function.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/gastos/confirm-nota.body.ts`:

```ts
import { IsIn, IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';
import type { ConfirmNotaDto, ExpenseCategory } from '@yield2pay/shared';

export class ConfirmNotaBody implements ConfirmNotaDto {
  @Matches(/^\d{44}$/)
  accessKey!: string;

  @IsString()
  @Length(1, 120)
  merchant!: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  amountCents!: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  spentOn!: string;

  @IsIn(['mercado', 'conta_da_casa', 'transporte', 'outros'])
  category!: ExpenseCategory;
}
```

Add to `GastosService`:

```ts
  async confirmNota(companyId: string, dto: ConfirmNotaDto): Promise<MonthExpenseView> {
    const amountCents = parseCentavos(dto.amountCents);
    const spentOn = calendarDate(dto.spentOn);
    try {
      const row = await this.prisma.monthExpense.create({
        data: {
          companyId,
          amountCents,
          merchant: dto.merchant.trim(),
          spentOn,
          source: 'nota',
          category: dto.category,
          accessKey: dto.accessKey,
          recurringAccountId: null,
          yearMonth: null,
        },
      });
      return toMonthExpenseView(row);
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2002') {
        throw new ConflictException('nota já lançada');
      }
      throw e;
    }
  }
```

And the date helper in the same file:

```ts
function calendarDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new BadRequestException('spentOn must be YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new BadRequestException('spentOn is not a calendar date');
  }
  return date;
}
```

Import `BadRequestException` and `ConfirmNotaDto`. Add the controller method:

```ts
  @Post('notas')
  confirmNota(@Req() req: AuthenticatedRequest, @Body() body: ConfirmNotaBody) {
    return this.gastos.confirmNota(req.companyId, body);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run from `apps/api`: `pnpm exec vitest run src/gastos/confirm-nota.body.spec.ts src/gastos/gastos.service.spec.ts src/gastos/gastos.controller.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gastos
git commit -m "feat: save a confirmed NFC-e with its access key"
```

---

### Task 9: List the current São Paulo month

**Files:**
- Modify: `apps/api/src/gastos/gastos.service.ts`
- Modify: `apps/api/src/gastos/gastos.service.spec.ts`
- Modify: `apps/api/src/gastos/gastos.controller.ts`
- Modify: `apps/api/src/gastos/gastos.controller.spec.ts`

**Interfaces:**
- Consumes: `monthRange`, `saoPauloYearMonth`, `toMonthExpenseView`, `MonthExpensesView`.
- Produces: `GastosService.listMonth(companyId: string, now?: Date): Promise<MonthExpensesView>`.
  - `month` is `saoPauloYearMonth(now)`.
  - Rows where `companyId` matches and `spentOn` is `>= start` and `< end` from `monthRange`.
  - Order `spentOn asc`, then `createdAt asc`.
  - `GET /gastos` passes `req.companyId`.

- [ ] **Step 1: Write the failing test**

Append to `gastos.service.spec.ts`:

```ts
it('lists only the company rows inside the current São Paulo month', async () => {
  const prisma = {
    monthExpense: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'exp_1',
          amountCents: 15000,
          merchant: 'Luz',
          spentOn: new Date('2026-10-04T00:00:00.000Z'),
          source: 'conta',
          category: 'conta_da_casa',
        },
      ]),
    },
  } as any;
  const svc = new GastosService(prisma);
  const view = await svc.listMonth('co_1', new Date('2026-10-04T15:00:00.000Z'));
  expect(prisma.monthExpense.findMany).toHaveBeenCalledWith({
    where: {
      companyId: 'co_1',
      spentOn: {
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lt: new Date('2026-11-01T00:00:00.000Z'),
      },
    },
    orderBy: [{ spentOn: 'asc' }, { createdAt: 'asc' }],
  });
  expect(view).toEqual({
    month: '2026-10',
    expenses: [
      {
        id: 'exp_1',
        amountCents: 15000,
        merchant: 'Luz',
        spentOn: '2026-10-04',
        source: 'conta',
        category: 'conta_da_casa',
      },
    ],
  });
});
```

Append to `gastos.controller.spec.ts`:

```ts
it('GET /gastos passes req.companyId', async () => {
  const gastos = { listMonth: vi.fn().mockResolvedValue({ month: '2026-10', expenses: [] }) };
  const ctrl = new GastosController(gastos as any);
  await ctrl.listMonth({ companyId: 'co_1' } as any);
  expect(gastos.listMonth).toHaveBeenCalledWith('co_1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/api`: `pnpm exec vitest run src/gastos/gastos.service.spec.ts src/gastos/gastos.controller.spec.ts`

Expected: FAIL — `listMonth` is not a function.

- [ ] **Step 3: Write minimal implementation**

Add to `GastosService`:

```ts
  async listMonth(companyId: string, now: Date = new Date()): Promise<MonthExpensesView> {
    const month = saoPauloYearMonth(now);
    const range = monthRange(month);
    const rows = await this.prisma.monthExpense.findMany({
      where: { companyId, spentOn: { gte: range.start, lt: range.end } },
      orderBy: [{ spentOn: 'asc' }, { createdAt: 'asc' }],
    });
    return { month, expenses: rows.map(toMonthExpenseView) };
  }
```

Import `monthRange` and `MonthExpensesView`. Add to the controller:

```ts
  @Get()
  listMonth(@Req() req: AuthenticatedRequest) {
    return this.gastos.listMonth(req.companyId);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run from `apps/api`: `pnpm exec vitest run src/gastos`

Expected: PASS for every spec under `src/gastos`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gastos
git commit -m "feat: list the current month of household expenses"
```

---

### Task 10: The `/family/gastos` screen

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/app/family/gastos/format.ts`
- Test: `apps/web/src/app/family/gastos/format.test.ts`
- Create: `apps/web/src/app/family/gastos/scanQr.ts`
- Test: `apps/web/src/app/family/gastos/scanQr.test.ts`
- Create: `apps/web/src/app/family/gastos/page.tsx`
- Test: `apps/web/src/app/family/gastos/page.test.tsx`
- Modify: `apps/web/package.json` (dependency `@zxing/browser` only)
- Modify: `apps/web/src/app/family/_lib/familyI18n.ts` (`dash.gastos`)
- Modify: `apps/web/src/app/family/_components/DashboardHeader.tsx`
- Modify: `apps/web/src/app/family/family.test.tsx`

**Interfaces:**
- Consumes: the six HTTP routes and the shared view types. `createApi(getToken)` from `apps/web/src/lib/api.ts`. `usePrivy().getAccessToken`. `isPrivyConfigured`. `BackHeader` from `apps/web/src/app/family/_components/FamilyUI.tsx`. `C` from `familyTheme`. `ApiError` from `@/lib/api`.
- Produces, on `createApi`:
  - `listMonth(): Promise<MonthExpensesView>` → `GET /gastos`
  - `listContas(): Promise<RecurringAccountView[]>` → `GET /gastos/contas`
  - `createConta(body: CreateContaDto): Promise<RecurringAccountView>` → `POST /gastos/contas`
  - `jaGastei(id: string, body: JaGasteiDto): Promise<MonthExpenseView>` → `POST /gastos/contas/${id}/ja-gastei`
  - `consultarNota(body: ConsultarNotaDto): Promise<NotaConsultaView>` → `POST /gastos/notas/consultar`
  - `confirmNota(body: ConfirmNotaDto): Promise<MonthExpenseView>` → `POST /gastos/notas`
- Produces `formatCentavos(cents: number): string` (`17119` → `R$ 171,19`), `formatIsoDate(iso: string): string` (`2026-10-04` → `04/10/2026`), `reaisToCentavos(input: string): number | null` (`150,00` and `150` → `15000`; more than two decimals → `null`).
- Produces `readQrFromVideo(video: HTMLVideoElement): Promise<string>` — `BarcodeDetector` when present, otherwise `@zxing/browser` `BrowserMultiFormatReader.decodeOnceFromVideoElement`. Returns the raw QR text. Does not parse the key and does not call the API.
- Produces the page at `apps/web/src/app/family/gastos/page.tsx`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/app/family/gastos/format.test.ts`:

```ts
import { formatCentavos, formatIsoDate, reaisToCentavos } from './format';

it('formats centavos as BRL without using float USDC units', () => {
  expect(formatCentavos(17119)).toBe('R$ 171,19');
  expect(formatCentavos(15000)).toBe('R$ 150,00');
  expect(formatIsoDate('2026-10-04')).toBe('04/10/2026');
});

it('reads a reais field into centavos', () => {
  expect(reaisToCentavos('150,00')).toBe(15000);
  expect(reaisToCentavos('1.234,56')).toBe(123456);
  expect(reaisToCentavos('150')).toBe(15000);
  expect(reaisToCentavos('1,234')).toBeNull();
});
```

`apps/web/src/app/family/gastos/scanQr.test.ts`:

```ts
import { readQrFromVideo } from './scanQr';

it('returns the raw QR text from BarcodeDetector', async () => {
  const detect = vi.fn().mockResolvedValue([{ rawValue: 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=1' }]);
  vi.stubGlobal('BarcodeDetector', vi.fn(function BarcodeDetector() {
    return { detect };
  }));
  const video = document.createElement('video');
  await expect(readQrFromVideo(video)).resolves.toBe('https://www.nfce.fazenda.sp.gov.br/qrcode?p=1');
  vi.unstubAllGlobals();
});
```

`apps/web/src/app/family/gastos/page.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({
  listMonth: vi.fn(),
  listContas: vi.fn(),
  createConta: vi.fn(),
  jaGastei: vi.fn(),
  consultarNota: vi.fn(),
  confirmNota: vi.fn(),
}));
const privy = vi.hoisted(() => ({ configured: true }));
const scan = vi.hoisted(() => ({ scanQr: vi.fn() }));

vi.mock('@/lib/api', () => ({ createApi: () => api }));
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({ getAccessToken: async () => 'tok' }),
}));
vi.mock('@/providers/PrivyProviderWrapper', () => ({
  get isPrivyConfigured() {
    return privy.configured;
  },
}));
vi.mock('./scanQr', () => ({ scanQr: (...args: unknown[]) => scan.scanQr(...args) }));

import GastosPage from './page';

const KEY = '35261000000000000191650010000000011000000013';

beforeEach(() => {
  privy.configured = true;
  api.listMonth.mockReset().mockResolvedValue({ month: '2026-10', expenses: [] });
  api.listContas.mockReset().mockResolvedValue([]);
  api.createConta.mockReset();
  api.jaGastei.mockReset();
  api.consultarNota.mockReset();
  api.confirmNota.mockReset();
  scan.scanQr.mockReset();
});

describe('/family/gastos', () => {
  it('lists the current month as amount, merchant, and date', async () => {
    api.listMonth.mockResolvedValue({
      month: '2026-10',
      expenses: [
        { id: 'e1', amountCents: 17119, merchant: 'MERCADO EXEMPLO', spentOn: '2026-10-04', source: 'nota', category: 'mercado' },
      ],
    });
    render(<GastosPage />);
    expect(await screen.findByText('MERCADO EXEMPLO')).toBeInTheDocument();
    expect(screen.getByText('R$ 171,19')).toBeInTheDocument();
    expect(screen.getByText('04/10/2026')).toBeInTheDocument();
  });

  it('shows an empty month', async () => {
    render(<GastosPage />);
    expect(await screen.findByText('Nenhum gasto neste mês.')).toBeInTheDocument();
  });

  it('saves a recurring account without posting a month row', async () => {
    api.createConta.mockResolvedValue({ id: 'c1', name: 'Luz', amountCents: 15000, spentThisMonth: false });
    render(<GastosPage />);
    fireEvent.change(await screen.findByLabelText('Nome da conta'), { target: { value: 'Luz' } });
    fireEvent.change(screen.getByLabelText('Valor da conta'), { target: { value: '150,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar conta' }));
    expect(await screen.findByRole('button', { name: 'já gastei Luz' })).toBeInTheDocument();
    expect(api.createConta).toHaveBeenCalledWith({ name: 'Luz', amountCents: 15000 });
    expect(api.jaGastei).not.toHaveBeenCalled();
    expect(api.confirmNota).not.toHaveBeenCalled();
    expect(screen.getByText('Nenhum gasto neste mês.')).toBeInTheDocument();
  });

  it('posts já gastei once, with the category chosen on confirm', async () => {
    api.listContas.mockResolvedValue([{ id: 'c1', name: 'Luz', amountCents: 15000, spentThisMonth: false }]);
    api.jaGastei.mockResolvedValue({
      id: 'e1', amountCents: 15000, merchant: 'Luz', spentOn: '2026-10-04', source: 'conta', category: 'conta_da_casa',
    });
    render(<GastosPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'já gastei Luz' }));
    fireEvent.change(screen.getByLabelText('Categoria do gasto'), { target: { value: 'conta_da_casa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar gasto' }));
    expect(api.jaGastei).toHaveBeenCalledWith('c1', { category: 'conta_da_casa' });
    expect(await screen.findByText('04/10/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Já lançado neste mês' })).toBeDisabled();
  });

  it('does not call já gastei when this month already has the row', async () => {
    api.listContas.mockResolvedValue([{ id: 'c1', name: 'Luz', amountCents: 15000, spentThisMonth: true }]);
    render(<GastosPage />);
    const button = await screen.findByRole('button', { name: 'Já lançado neste mês' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(api.jaGastei).not.toHaveBeenCalled();
  });

  it('keeps a consulted SP receipt read-only until confirm, and confirm sends the category', async () => {
    scan.scanQr.mockResolvedValue(`https://www.nfce.fazenda.sp.gov.br/qrcode?p=${KEY}|3|1`);
    api.consultarNota.mockResolvedValue({
      accessKey: KEY, cUf: '35', ufSupported: true, consultOk: true,
      merchant: 'MERCADO EXEMPLO', amountCents: 17119, spentOn: '2026-10-04',
    });
    api.confirmNota.mockResolvedValue({
      id: 'e2', amountCents: 17119, merchant: 'MERCADO EXEMPLO', spentOn: '2026-10-04', source: 'nota', category: 'mercado',
    });
    render(<GastosPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ler QR da nota' }));
    expect(await screen.findByLabelText('Estabelecimento')).toHaveProperty('readOnly', true);
    expect(screen.getByLabelText('Valor da nota')).toHaveProperty('readOnly', true);
    expect(screen.getByLabelText('Data da nota')).toHaveProperty('readOnly', true);
    expect(api.confirmNota).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Categoria da nota'), { target: { value: 'mercado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nota' }));
    expect(api.confirmNota).toHaveBeenCalledWith({
      accessKey: KEY, merchant: 'MERCADO EXEMPLO', amountCents: 17119, spentOn: '2026-10-04', category: 'mercado',
    });
  });

  it('leaves merchant, amount, and date editable when the UF is not SP, and still stores the key', async () => {
    const rj = `33${'0'.repeat(42)}`;
    scan.scanQr.mockResolvedValue(rj);
    api.consultarNota.mockResolvedValue({
      accessKey: rj, cUf: '33', ufSupported: false, consultOk: false,
      merchant: null, amountCents: null, spentOn: null,
    });
    api.confirmNota.mockResolvedValue({
      id: 'e3', amountCents: 1000, merchant: 'Feira', spentOn: '2026-10-04', source: 'nota', category: 'outros',
    });
    render(<GastosPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ler QR da nota' }));
    const merchant = await screen.findByLabelText('Estabelecimento');
    expect(merchant).toHaveProperty('readOnly', false);
    fireEvent.change(merchant, { target: { value: 'Feira' } });
    fireEvent.change(screen.getByLabelText('Valor da nota'), { target: { value: '10,00' } });
    fireEvent.change(screen.getByLabelText('Data da nota'), { target: { value: '2026-10-04' } });
    fireEvent.change(screen.getByLabelText('Categoria da nota'), { target: { value: 'outros' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nota' }));
    expect(api.confirmNota).toHaveBeenCalledWith({
      accessKey: rj, merchant: 'Feira', amountCents: 1000, spentOn: '2026-10-04', category: 'outros',
    });
  });

  it('asks the person to sign in when Privy is not configured', () => {
    privy.configured = false;
    render(<GastosPage />);
    expect(screen.getByText('Entre com sua conta para ver os gastos do mês.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ler QR da nota' })).not.toBeInTheDocument();
  });
});
```

Append to the dashboard describe in `apps/web/src/app/family/family.test.tsx`:

```tsx
  it('leva aos gastos do mês', () => {
    renderInFamily(<FamilyDashboardPage />);
    expect(screen.getByRole('link', { name: 'Gastos' })).toHaveAttribute('href', '/family/gastos');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/web`: `pnpm exec vitest run src/app/family/gastos/format.test.ts src/app/family/gastos/scanQr.test.ts src/app/family/gastos/page.test.tsx src/app/family/family.test.tsx`

Expected: FAIL — `./format`, `./scanQr`, and `./page` do not resolve. The family test fails because the link `Gastos` is absent.

- [ ] **Step 3: Write minimal implementation**

From `apps/web`: `pnpm add @zxing/browser`

`apps/web/src/app/family/gastos/format.ts`:

```ts
export function formatCentavos(cents: number): string {
  const reais = Math.floor(Math.abs(cents) / 100).toLocaleString('pt-BR');
  const frac = String(Math.abs(cents) % 100).padStart(2, '0');
  return `R$ ${reais},${frac}`;
}

export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** "1.234,56" or "150" → centavos. More than two decimal places → null. */
export function reaisToCentavos(input: string): number | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/);
  if (!match) return null;
  const reais = Number(match[1].replace(/\./g, ''));
  const frac = (match[2] ?? '').padEnd(2, '0');
  const cents = reais * 100 + Number(frac || '0');
  if (!Number.isInteger(cents) || cents < 1 || cents > 2147483647) return null;
  return cents;
}
```

`apps/web/src/app/family/gastos/scanQr.ts`:

```ts
type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> };

export async function readQrFromVideo(video: HTMLVideoElement): Promise<string> {
  const DetectorCtor = (globalThis as { BarcodeDetector?: new (opts: { formats: string[] }) => Detector }).BarcodeDetector;
  if (DetectorCtor) {
    const detector = new DetectorCtor({ formats: ['qr_code'] });
    const started = Date.now();
    while (Date.now() - started < 20_000) {
      const codes = await detector.detect(video);
      const value = codes[0]?.rawValue;
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('qr not found');
  }
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const reader = new BrowserMultiFormatReader();
  const result = await reader.decodeOnceFromVideoElement(video);
  return result.getText();
}

export async function scanQr(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await video.play();
    return await readQrFromVideo(video);
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}
```

In `apps/web/src/lib/api.ts`, import the gastos types from `@yield2pay/shared` and add the six methods to `ApiMethods` and to the object returned by `createApi`:

```ts
    listMonth: () => request('/gastos'),
    listContas: () => request('/gastos/contas'),
    createConta: (body: CreateContaDto) => request('/gastos/contas', 'POST', body),
    jaGastei: (id: string, body: JaGasteiDto) => request(`/gastos/contas/${id}/ja-gastei`, 'POST', body),
    consultarNota: (body: ConsultarNotaDto) => request('/gastos/notas/consultar', 'POST', body),
    confirmNota: (body: ConfirmNotaDto) => request('/gastos/notas', 'POST', body),
```

In `familyI18n.ts`, add `gastos: 'Gastos'` beside `concepts` in the Portuguese `dash` object, and `gastos: 'Expenses'` beside the English `concepts`.

In `DashboardHeader.tsx`, add this link immediately before the conceitos link:

```tsx
          <Link
            href="/family/gastos"
            className="fam-quiet"
            style={{ fontSize: 13.5, color: C.text2, textDecoration: 'none' }}
          >
            {t.dash.gastos}
          </Link>
```

`apps/web/src/app/family/gastos/page.tsx`:

```tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import type { ExpenseCategory, MonthExpenseView, NotaConsultaView, RecurringAccountView } from '@yield2pay/shared';
import { createApi } from '@/lib/api';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';
import { BackHeader } from '../_components/FamilyUI';
import { C } from '../_lib/familyTheme';
import { formatCentavos, formatIsoDate, reaisToCentavos } from './format';
import { scanQr } from './scanQr';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'mercado', label: 'Mercado' },
  { value: 'conta_da_casa', label: 'Conta da casa' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'outros', label: 'Outros' },
];

function SignedOut() {
  return (
    <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
      <BackHeader label="‹ Voltar ao painel" />
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '28px var(--fam-gutter) 72px' }}>
        <p style={{ color: C.text2, lineHeight: 1.6 }}>Entre com sua conta para ver os gastos do mês.</p>
        <Link href="/login" style={{ color: C.silver }}>Entrar</Link>
      </main>
    </div>
  );
}

export default function GastosPage() {
  if (!isPrivyConfigured) return <SignedOut />;
  return <GastosScreen />;
}

function GastosScreen() {
  const { getAccessToken } = usePrivy();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  const [expenses, setExpenses] = useState<MonthExpenseView[]>([]);
  const [contas, setContas] = useState<RecurringAccountView[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [openConta, setOpenConta] = useState<string | null>(null);
  const [contaCategory, setContaCategory] = useState<ExpenseCategory | ''>('');
  const [nota, setNota] = useState<NotaConsultaView | null>(null);
  const [merchant, setMerchant] = useState('');
  const [notaAmount, setNotaAmount] = useState('');
  const [notaDate, setNotaDate] = useState('');
  const [notaCategory, setNotaCategory] = useState<ExpenseCategory | ''>('');
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [month, saved] = await Promise.all([api.listMonth(), api.listContas()]);
      if (cancelled) return;
      setExpenses(month.expenses);
      setContas(saved);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function saveConta(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = reaisToCentavos(amount);
    if (!name.trim() || amountCents == null) return;
    const saved = await api.createConta({ name: name.trim(), amountCents });
    setContas((prev) => [...prev, saved]);
    setName('');
    setAmount('');
  }

  async function confirmGasto(id: string) {
    if (!contaCategory) return;
    const row = await api.jaGastei(id, { category: contaCategory });
    setExpenses((prev) => [...prev, row]);
    setContas((prev) => prev.map((conta) => (conta.id === id ? { ...conta, spentThisMonth: true } : conta)));
    setOpenConta(null);
    setContaCategory('');
  }

  async function readNota() {
    setCameraError('');
    try {
      const qrText = await scanQr();
      const view = await api.consultarNota({ qrText });
      setNota(view);
      setMerchant(view.merchant ?? '');
      setNotaAmount(view.amountCents == null ? '' : formatReaisInput(view.amountCents));
      setNotaDate(view.spentOn ?? '');
      setNotaCategory('');
    } catch {
      setCameraError('Não foi possível abrir a câmera.');
    }
  }

  async function confirmNota(e: React.FormEvent) {
    e.preventDefault();
    if (!nota || !notaCategory) return;
    const amountCents = nota.consultOk ? nota.amountCents : reaisToCentavos(notaAmount);
    const spentOn = nota.consultOk ? nota.spentOn : notaDate;
    if (!merchant.trim() || amountCents == null || !spentOn) return;
    const row = await api.confirmNota({
      accessKey: nota.accessKey,
      merchant: merchant.trim(),
      amountCents,
      spentOn,
      category: notaCategory,
    });
    setExpenses((prev) => [...prev, row]);
    setNota(null);
  }

  const locked = nota?.consultOk === true;

  return (
    <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
      <BackHeader label="‹ Voltar ao painel" />
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '28px var(--fam-gutter) 72px', color: C.text }}>
        <h1 style={{ fontSize: 28, margin: '0 0 16px' }}>Gastos do mês</h1>
        {expenses.length === 0 ? (
          <p>Nenhum gasto neste mês.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {expenses.map((row) => (
              <li key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                <span>{row.merchant}</span>
                <span>{formatCentavos(row.amountCents)}</span>
                <span>{formatIsoDate(row.spentOn)}</span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={saveConta} style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 18 }}>Conta recorrente</h2>
          <label>Nome da conta<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Valor da conta<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></label>
          <button type="submit">Salvar conta</button>
        </form>

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {contas.map((conta) => (
            <li key={conta.id} style={{ padding: '8px 0' }}>
              <span>{conta.name}</span> <span>{formatCentavos(conta.amountCents)}</span>
              {conta.spentThisMonth ? (
                <button type="button" disabled>Já lançado neste mês</button>
              ) : (
                <button type="button" aria-label={`já gastei ${conta.name}`} onClick={() => setOpenConta(conta.id)}>já gastei</button>
              )}
              {openConta === conta.id && !conta.spentThisMonth && (
                <>
                  <label>
                    Categoria do gasto
                    <select value={contaCategory} onChange={(e) => setContaCategory(e.target.value as ExpenseCategory)}>
                      <option value="">Escolha</option>
                      {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => void confirmGasto(conta.id)}>Confirmar gasto</button>
                </>
              )}
            </li>
          ))}
        </ul>

        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 18 }}>Nota</h2>
          <button type="button" onClick={() => void readNota()}>Ler QR da nota</button>
          {cameraError && <p role="alert">{cameraError}</p>}
          {nota && (
            <form onSubmit={confirmNota}>
              <label>Estabelecimento<input aria-label="Estabelecimento" value={merchant} readOnly={locked} onChange={(e) => setMerchant(e.target.value)} /></label>
              <label>Valor da nota<input aria-label="Valor da nota" value={notaAmount} readOnly={locked} onChange={(e) => setNotaAmount(e.target.value)} /></label>
              <label>Data da nota<input aria-label="Data da nota" type="date" value={notaDate} readOnly={locked} onChange={(e) => setNotaDate(e.target.value)} /></label>
              <label>
                Categoria da nota
                <select value={notaCategory} onChange={(e) => setNotaCategory(e.target.value as ExpenseCategory)}>
                  <option value="">Escolha</option>
                  {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <button type="submit">Confirmar nota</button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

function formatReaisInput(cents: number): string {
  const reais = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, '0');
  return `${reais},${frac}`;
}
```

`notaDate` stays `YYYY-MM-DD` in state, including when the field is read-only, because `type="date"` requires that shape and confirm sends that same string. There is no free-text category and no control that creates a category.

- [ ] **Step 4: Run test to verify it passes**

Run from `apps/web`: `pnpm exec vitest run src/app/family/gastos/format.test.ts src/app/family/gastos/scanQr.test.ts src/app/family/gastos/page.test.tsx src/app/family/family.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/app/family/gastos apps/web/src/app/family/_components/DashboardHeader.tsx apps/web/src/app/family/_lib/familyI18n.ts apps/web/src/app/family/family.test.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add the family gastos screen"
```

---

## Self-review

Spec coverage:

- No blockchain, Open Finance, payment, debit, due date, reminder, or user-created category: the schema, routes, and screen have none of those fields or controls.
- One API module (`gastos`) and one screen (`/family/gastos`), outside venue.
- Month row fields are amount, merchant, date, source, category. Category is required by `JaGasteiBody` and `ConfirmNotaBody` and is chosen on the screen before either confirm button.
- Categories are the four enum values only.
- Money is `Int` centavos. `RecurringBill.monthlyCost` is untouched.
- Every mutating and list route takes `req.companyId` from `AuthGuard`.
- A recurring account insert does not call `monthExpense.create`. "já gastei" does, and `P2002` plus `spentThisMonth` stop a second row.
- The camera returns raw QR text. The API extracts the 44-digit key, consults SEFAZ-SP only for cUF 35, and shows merchant, amount, and date. Confirm is a separate POST.
- Consult failure and a non-SP UF leave the three inputs writable and `confirmNota` still sends `accessKey`.
- The screen lists the current month as amount, merchant, and date. The header link is how the family app reaches it.

Placeholder scan: no TBD, TODO, or "implement later".

Type consistency: `amountCents`, `spentOn`, `accessKey`, `consultOk`, `ufSupported`, `cUf`, `yearMonth`, and the four categories use the same names in shared types, Prisma, service, client, and the screen.
