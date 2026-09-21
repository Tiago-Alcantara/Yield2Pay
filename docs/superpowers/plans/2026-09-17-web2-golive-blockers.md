# Web2 go-live blockers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar só o que bloqueia colocar o Yield2Pay B2B no ar (web2 + banco): API não sobe aberta, sandbox morto em production, bills validados, rate limit, `/health` no Postgres, headers no Next, termos/privacidade clicáveis, exportar/apagar conta, e o host com env/plano de produção.

**Architecture:** Extrair funções puras (CORS, rate limit, sandbox) e testá-las no Vitest que o repo já usa. Sem `@nestjs/throttler` — `class-validator` já está na API. Sem mexer em `/family`, Stellar, cofre ou rampa de dinheiro, além de desligar as duas rotas de sandbox em `APP_ENV=production`. Infra de host (Render/Vercel/Privy) vira o Task 10: yaml + runbook; o clique pago no dashboard é do humano.

**Tech Stack:** NestJS 11, Zod env, class-validator, Prisma 7, Next.js 16, Vitest, render.yaml, Vercel env.

## Global Constraints

- Escopo = itens `severity: blocker` do canvas go-live. Não implementar high/soon (CI, Sentry, schema extra de bills, telas mortas do dashboard).
- `/family` fora. Web3 fora, exceto recusar `POST /ramp/kyc-approved` e `POST /ramp/onramp/simulate` quando `APP_ENV=production`.
- Seguir `docs/Preference - Coding Style.md`: linear, nomes explícitos, sem helper que só encaminha, sem `any` novo.
- Sem dependência nova. Rate limit é `Map` em memória no processo.
- TDD: teste falha → código → teste passa.
- Agent **never** `git commit` / `git add` para commit / push. O usuário commita.
- Não commitar `.env`. Windows + pnpm (`pnpm@10.33.2`).
- E-mail de suporte já usado nas telas de erro: `suporte@yield2pay.com.br`.

## File structure

| File | Responsibility |
|---|---|
| `apps/api/src/config/env.ts` | `CORS_ORIGIN` no Zod; production recusa boot sem origem |
| `apps/api/src/main.ts` | CORS a partir de `config.corsOrigins`; rate-limit middleware |
| `apps/api/src/auth/auth.guard.ts` | Sem log do Bearer |
| `apps/api/src/common/assert-sandbox.ts` | `ForbiddenException` se `appEnv === 'production'` |
| `apps/api/src/ramp/ramp.controller.ts` | Chama o assert nas duas rotas sandbox |
| `apps/api/src/bills/create-bill.body.ts` | class-validator do POST `/bills` |
| `apps/api/src/common/rate-limit.ts` | `allowRequest` puro + constantes |
| `packages/shared/src/index.ts` | `ErrorStatusCode` ganha `429` |
| `apps/api/src/common/all-exceptions.filter.ts` | Normaliza 429 |
| `apps/web/src/lib/errorCopy.ts` + `errorDetails.ts` | Cópia e allowlist do 429 |
| `apps/api/src/health/health.controller.ts` | `SELECT 1` no Postgres |
| `apps/web/src/lib/securityHeaders.ts` | Headers estáticos; `next.config.ts` só aplica |
| `apps/web/src/app/termos/page.tsx` | Termos PT |
| `apps/web/src/app/privacidade/page.tsx` | Privacidade PT (LGPD) |
| `apps/web/src/app/login/page.tsx` + `page.tsx` (landing) | Links reais |
| `apps/api/src/company/company.service.ts` | `exportAccount` / `deleteAccount` |
| `apps/api/src/account/account.controller.ts` | `GET /account/export`, `DELETE /account` |
| `render.yaml` + `docs/DEPLOY.md` | APP_ENV production, planos pagos, checklist humano |

---

### Task 1: CORS falha fechado em production

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/config/env.spec.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/.env.example` (comentário: obrigatório em production)

**Interfaces:**
- Consumes: `loadEnv` atual (`APP_ENV` já existe)
- Produces: `Env.corsOrigins: string[] | undefined` — `undefined` só fora de production (Nest `origin: true`). Em production, array com ≥1 origem, senão `loadEnv` lança.

- [ ] **Step 1: Write the failing test**

Acrescentar no fim de `apps/api/src/config/env.spec.ts`:

```ts
it('rejects production without CORS_ORIGIN', () => {
  expect(() => loadEnv({ ...base, APP_ENV: 'production' })).toThrow(
    /CORS_ORIGIN/,
  );
});

it('parses comma-separated CORS origins in production', () => {
  const env = loadEnv({
    ...base,
    APP_ENV: 'production',
    CORS_ORIGIN: 'https://yield2pay.vercel.app, https://www.yield2pay.com',
  });
  expect(env.corsOrigins).toEqual([
    'https://yield2pay.vercel.app',
    'https://www.yield2pay.com',
  ]);
});

it('leaves corsOrigins undefined when CORS_ORIGIN is unset outside production', () => {
  expect(loadEnv(base).corsOrigins).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/config/env.spec.ts
```

Expected: FAIL — `corsOrigins` does not exist / production without CORS_ORIGIN still parses.

- [ ] **Step 3: Write minimal implementation**

Em `apps/api/src/config/env.ts`, no `schema`:

```ts
CORS_ORIGIN: z.string().optional(),
```

No tipo `Env`, adicionar `corsOrigins: string[] | undefined`.

Em `loadEnv`, depois do `schema.parse`:

```ts
function parseCorsOrigins(
  appEnv: AppEnv,
  raw: string | undefined,
): string[] | undefined {
  const parts = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (appEnv === 'production') {
    if (parts.length === 0) {
      throw new Error('CORS_ORIGIN is required when APP_ENV=production');
    }
    return parts;
  }
  return parts.length > 0 ? parts : undefined;
}
```

Mapear `corsOrigins: parseCorsOrigins(parsed.APP_ENV, parsed.CORS_ORIGIN)`.

Em `apps/api/src/main.ts`, trocar o bloco CORS por:

```ts
const config = app.get<Env>(APP_CONFIG);
app.enableCors({
  origin: config.corsOrigins ?? true,
  credentials: true,
});
```

Mover `const config = app.get<Env>(APP_CONFIG)` para **antes** de `enableCors` (hoje o `config` só é lido depois). Remover a leitura direta de `process.env.CORS_ORIGIN`.

Atualizar o comentário em `apps/api/.env.example`: production exige `CORS_ORIGIN`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/config/env.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Do not commit**

Repo forbids agent commits. Stop here.

---

### Task 2: Parar de logar o Bearer token

**Files:**
- Modify: `apps/api/src/auth/auth.guard.ts`
- Modify: `apps/api/src/auth/auth.guard.spec.ts`

**Interfaces:**
- Consumes: `AuthGuard.canActivate` existente
- Produces: mesmo contrato; nenhum `console.log` com `authorization`

- [ ] **Step 1: Write the failing test**

Acrescentar em `apps/api/src/auth/auth.guard.spec.ts`:

```ts
it('does not log the authorization header', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const privy = {
    verify: vi.fn().mockResolvedValue({ privyUserId: 'did:privy:z' }),
  };
  const company = { findOrCreate: vi.fn().mockResolvedValue({ id: 'co_9' }) };
  const guard = new AuthGuard(privy as any, company as any);
  const req: { headers: Record<string, string>; companyId?: string } = {
    headers: { authorization: 'Bearer tok123secret' },
  };
  await guard.canActivate({
    switchToHttp: () => ({ getRequest: () => req }),
  } as any);
  const printed = [...log.mock.calls, ...error.mock.calls]
    .flat()
    .map(String)
    .join(' ');
  expect(printed).not.toContain('tok123secret');
  expect(printed).not.toContain('Bearer tok123');
  log.mockRestore();
  error.mockRestore();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/auth/auth.guard.spec.ts
```

Expected: FAIL — printed contains `Bearer tok123`.

- [ ] **Step 3: Write minimal implementation**

Em `auth.guard.ts`, apagar o `console.log('[AuthGuard] HIT', ...)`. Manter os `console.error` de falha de verify/findOrCreate — eles não imprimem o token.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/auth/auth.guard.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Do not commit**

---

### Task 3: Desligar rotas de sandbox em production

**Files:**
- Create: `apps/api/src/common/assert-sandbox.ts`
- Create: `apps/api/src/common/assert-sandbox.spec.ts`
- Create: `apps/api/src/ramp/ramp.controller.spec.ts`
- Modify: `apps/api/src/ramp/ramp.controller.ts`

**Interfaces:**
- Consumes: `Env.appEnv`
- Produces: `assertSandboxEnabled(appEnv: AppEnv): void` — no-op fora de production; `ForbiddenException` em production

- [ ] **Step 1: Write the failing test**

`apps/api/src/common/assert-sandbox.spec.ts`:

```ts
import { ForbiddenException } from '@nestjs/common';
import { assertSandboxEnabled } from './assert-sandbox';

it('allows sandbox outside production', () => {
  expect(() => assertSandboxEnabled('development')).not.toThrow();
  expect(() => assertSandboxEnabled('staging')).not.toThrow();
});

it('forbids sandbox in production', () => {
  expect(() => assertSandboxEnabled('production')).toThrow(ForbiddenException);
});
```

`apps/api/src/ramp/ramp.controller.spec.ts`:

```ts
import { ForbiddenException } from '@nestjs/common';
import { RampController } from './ramp.controller';

function makeController(appEnv: 'production' | 'staging') {
  const ramp = {
    markKycApproved: vi.fn().mockResolvedValue(undefined),
    simulateFiatReceived: vi.fn().mockResolvedValue(undefined),
  };
  const config = { appEnv };
  return {
    ctrl: new RampController(ramp as any, config as any),
    ramp,
  };
}

it('blocks kyc-approved in production before calling the service', async () => {
  const { ctrl, ramp } = makeController('production');
  await expect(
    ctrl.markKycApproved({ companyId: 'co_1' } as any),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(ramp.markKycApproved).not.toHaveBeenCalled();
});

it('blocks onramp/simulate in production before calling the service', async () => {
  const { ctrl, ramp } = makeController('production');
  await expect(
    ctrl.simulateFiatReceived({ companyId: 'co_1' } as any, { orderId: 'o1' }),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(ramp.simulateFiatReceived).not.toHaveBeenCalled();
});

it('delegates kyc-approved in staging', async () => {
  const { ctrl, ramp } = makeController('staging');
  await ctrl.markKycApproved({ companyId: 'co_1' } as any);
  expect(ramp.markKycApproved).toHaveBeenCalledWith('co_1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/common/assert-sandbox.spec.ts src/ramp/ramp.controller.spec.ts
```

Expected: FAIL — módulos/arquivos inexistentes; `RampController` hoje só recebe `RampService`.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/common/assert-sandbox.ts`:

```ts
import { ForbiddenException } from '@nestjs/common';
import type { AppEnv } from '@yield2pay/shared';

export function assertSandboxEnabled(appEnv: AppEnv): void {
  if (appEnv === 'production') {
    throw new ForbiddenException('sandbox routes are disabled in production');
  }
}
```

`ramp.controller.ts` — constructor e as duas rotas:

```ts
import { Inject } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env';
import { assertSandboxEnabled } from '../common/assert-sandbox';

@Controller('ramp')
@UseGuards(AuthGuard)
export class RampController {
  constructor(
    private readonly ramp: RampService,
    @Inject(APP_CONFIG) private readonly config: Env,
  ) {}

  @Post('kyc-approved')
  markKycApproved(@Req() req: AuthenticatedRequest) {
    assertSandboxEnabled(this.config.appEnv);
    return this.ramp.markKycApproved(req.companyId);
  }

  @Post('onramp/simulate')
  simulateFiatReceived(
    @Req() req: AuthenticatedRequest,
    @Body() body: { orderId: string },
  ) {
    assertSandboxEnabled(this.config.appEnv);
    return this.ramp.simulateFiatReceived(req.companyId, body.orderId);
  }
}
```

Manter os outros métodos iguais. `APP_CONFIG` já é global (`AppConfigModule`).

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/common/assert-sandbox.spec.ts src/ramp/ramp.controller.spec.ts src/ramp/ramp.service.spec.ts
```

Expected: PASS. Os specs do service de simulate/KYC continuam verdes — o gate é só no controller.

- [ ] **Step 5: Do not commit**

---

### Task 4: Validar o body de POST /bills

**Files:**
- Create: `apps/api/src/bills/create-bill.body.ts`
- Create: `apps/api/src/bills/create-bill.body.spec.ts`
- Modify: `apps/api/src/bills/bills.controller.ts`

**Interfaces:**
- Consumes: `CreateBillDto` em `@yield2pay/shared` (o front continua mandando `{ vendor, monthlyCost, type }`)
- Produces: classe `CreateBillBody` com os mesmos campos; `BillsController.create` recebe `CreateBillBody`

- [ ] **Step 1: Write the failing test**

`apps/api/src/bills/create-bill.body.spec.ts`:

```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBillBody } from './create-bill.body';

async function errorsOf(plain: Record<string, unknown>) {
  const instance = plainToInstance(CreateBillBody, plain);
  return validate(instance);
}

it('accepts a valid bill body', async () => {
  const errors = await errorsOf({
    vendor: 'OpenAI',
    monthlyCost: '2000000',
    type: 'software',
  });
  expect(errors).toHaveLength(0);
});

it('rejects an empty vendor', async () => {
  const errors = await errorsOf({
    vendor: '',
    monthlyCost: '1',
    type: 'software',
  });
  expect(errors.length).toBeGreaterThan(0);
});

it('rejects a vendor longer than 80 chars', async () => {
  const errors = await errorsOf({
    vendor: 'x'.repeat(81),
    monthlyCost: '1',
    type: 'software',
  });
  expect(errors.length).toBeGreaterThan(0);
});

it('rejects a non-digit monthlyCost', async () => {
  const errors = await errorsOf({
    vendor: 'OpenAI',
    monthlyCost: '12.5',
    type: 'software',
  });
  expect(errors.length).toBeGreaterThan(0);
});

it('rejects monthlyCost with more than 16 digits', async () => {
  const errors = await errorsOf({
    vendor: 'OpenAI',
    monthlyCost: '1'.repeat(17),
    type: 'software',
  });
  expect(errors.length).toBeGreaterThan(0);
});

it('rejects an unknown type', async () => {
  const errors = await errorsOf({
    vendor: 'OpenAI',
    monthlyCost: '1',
    type: 'saas',
  });
  expect(errors.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/bills/create-bill.body.spec.ts
```

Expected: FAIL — `CreateBillBody` not found.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/bills/create-bill.body.ts`:

```ts
import { IsIn, IsString, Length, Matches } from 'class-validator';
import type { BillType, CreateBillDto } from '@yield2pay/shared';

export class CreateBillBody implements CreateBillDto {
  @IsString()
  @Length(1, 80)
  vendor!: string;

  @IsString()
  @Length(1, 16)
  @Matches(/^\d+$/)
  monthlyCost!: string;

  @IsIn(['software', 'utility', 'other'])
  type!: BillType;
}
```

Em `bills.controller.ts`, trocar o import de `CreateBillDto` por `CreateBillBody` e o tipo do `@Body()`.

`parseBaseUnits` no service continua rejeitando `'0'`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/bills/create-bill.body.spec.ts src/bills/bills.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Do not commit**

---

### Task 5: Rate limit + status 429 no contrato de erro

**Files:**
- Create: `apps/api/src/common/rate-limit.ts`
- Create: `apps/api/src/common/rate-limit.spec.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `packages/shared/src/index.ts` (`ErrorStatusCode`)
- Modify: `apps/api/src/common/all-exceptions.filter.ts`
- Modify: `apps/api/src/common/all-exceptions.filter.spec.ts`
- Modify: `apps/web/src/lib/errorDetails.ts`
- Modify: `apps/web/src/lib/errorCopy.ts`
- Modify: `apps/web/src/lib/errorCopy.test.ts`

**Interfaces:**
- Consumes: `ErrorStatusCode` atual
- Produces: `allowRequest(buckets, key, nowMs, windowMs, maxHits): boolean`; `RATE_LIMIT_WINDOW_MS = 60_000`; `RATE_LIMIT_MAX_HITS = 60`; `ErrorStatusCode` inclui `429`

Sem pacote novo. Um `Map` no processo da API. `/health` não conta (Task 6 precisa que o Render continue pingando).

- [ ] **Step 1: Write the failing tests**

`apps/api/src/common/rate-limit.spec.ts`:

```ts
import { allowRequest, RATE_LIMIT_MAX_HITS } from './rate-limit';

it('allows the first request', () => {
  const buckets = new Map<string, number[]>();
  expect(allowRequest(buckets, '1.1.1.1', 1_000, 60_000, 2)).toBe(true);
});

it('rejects when the window is full', () => {
  const buckets = new Map<string, number[]>();
  expect(allowRequest(buckets, 'ip', 1_000, 60_000, 2)).toBe(true);
  expect(allowRequest(buckets, 'ip', 1_100, 60_000, 2)).toBe(true);
  expect(allowRequest(buckets, 'ip', 1_200, 60_000, 2)).toBe(false);
});

it('allows again after timestamps leave the window', () => {
  const buckets = new Map<string, number[]>();
  allowRequest(buckets, 'ip', 1_000, 1_000, 1);
  expect(allowRequest(buckets, 'ip', 1_500, 1_000, 1)).toBe(false);
  expect(allowRequest(buckets, 'ip', 2_100, 1_000, 1)).toBe(true);
});

it('isolates keys', () => {
  const buckets = new Map<string, number[]>();
  allowRequest(buckets, 'a', 1_000, 60_000, 1);
  expect(allowRequest(buckets, 'b', 1_000, 60_000, 1)).toBe(true);
});

it('exports a production cap of 60 hits per 60s', () => {
  expect(RATE_LIMIT_MAX_HITS).toBe(60);
});
```

Em `apps/web/src/lib/errorCopy.test.ts`, o array de status passa a incluir `429`:

```ts
expect(Object.keys(PAGE_COPY).map(Number).sort((a, b) => a - b)).toEqual([
  400, 401, 403, 404, 408, 429, 500, 502, 503,
]);
```

E `DIALOG_STATUS_CODES` inclui `429`.

Em `all-exceptions.filter.spec.ts`, o loop de status inclui `429`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/common/rate-limit.spec.ts src/common/all-exceptions.filter.spec.ts
pnpm --filter @yield2pay/web exec vitest run src/lib/errorCopy.test.ts
```

Expected: FAIL — `rate-limit` missing; 429 not in unions/copy.

- [ ] **Step 3: Write minimal implementation**

`apps/api/src/common/rate-limit.ts`:

```ts
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_HITS = 60;

export function allowRequest(
  buckets: Map<string, number[]>,
  key: string,
  nowMs: number,
  windowMs: number,
  maxHits: number,
): boolean {
  const cutoff = nowMs - windowMs;
  const kept = (buckets.get(key) ?? []).filter((stamp) => stamp > cutoff);
  if (kept.length >= maxHits) {
    buckets.set(key, kept);
    return false;
  }
  kept.push(nowMs);
  buckets.set(key, kept);
  return true;
}
```

`packages/shared/src/index.ts`:

```ts
export type ErrorStatusCode =
  | 400 | 401 | 403 | 404 | 408 | 429 | 500 | 502 | 503;
```

`all-exceptions.filter.ts` — incluir `429` em `RENDERABLE_STATUS_CODES`.

`errorDetails.ts` — o mesmo array.

`errorCopy.ts` — `PAGE_COPY[429]`:

```ts
429: {
  kicker: 'Erro 429 · muitas tentativas',
  title: 'Você fez pedidos demais em pouco tempo',
  msg: 'Aguarde alguns instantes e tente de novo. Se o aviso continuar, fale com o suporte.',
  primary: 'retry',
  secondary: 'home',
},
```

`DIALOG_STATUS_CODES = [400, 401, 403, 408, 429, 500]` e `DIALOG_COPY[429]` com `primary: 'retry'`, mensagem curta, `secondary: null`.

`main.ts` — depois do CORS, antes do listen:

```ts
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  allowRequest,
  RATE_LIMIT_MAX_HITS,
  RATE_LIMIT_WINDOW_MS,
} from './common/rate-limit';

const rateLimitBuckets = new Map<string, number[]>();
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.path.startsWith('/health/')) {
    next();
    return;
  }
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  if (
    !allowRequest(
      rateLimitBuckets,
      key,
      Date.now(),
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX_HITS,
    )
  ) {
    next(new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS));
    return;
  }
  next();
});
```

Express chama `next(err)`; o `AllExceptionsFilter` do Nest captura se o middleware estiver na cadeia Nest. Se o filtro global não pegar middleware Express, o `bootstrap` já tem o filter em `useGlobalFilters` — no Nest 11, `next(err)` no middleware registrado com `app.use` **depois** de `NestFactory.create` entra no exception layer. Se um teste manual mostrar HTML do Express, trocar o `next(err)` por `res.status(429).json` no mesmo formato `ApiErrorPayload` (gerar `errorId` com `generateErrorId()`). Preferir o `next(err)` primeiro.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/common/rate-limit.spec.ts src/common/all-exceptions.filter.spec.ts
pnpm --filter @yield2pay/web exec vitest run src/lib/errorCopy.test.ts src/lib/errorDetails.test.ts src/lib/errorNotifications.test.ts
```

Expected: PASS.

- [ ] **Step 5: Do not commit**

---

### Task 6: GET /health pinga o Postgres

**Files:**
- Modify: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.controller.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (módulo global)
- Produces: `{ status: 'ok' }` se `SELECT 1` ok; `ServiceUnavailableException` (503) se o banco não responde. O Render continua usando `healthCheckPath: /health`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/health/health.controller.spec.ts`:

```ts
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

it('returns ok when the database answers', async () => {
  const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
  const ctrl = new HealthController(prisma as any);
  await expect(ctrl.check()).resolves.toEqual({ status: 'ok' });
  expect(prisma.$queryRaw).toHaveBeenCalled();
});

it('throws 503 when the database does not answer', async () => {
  const prisma = {
    $queryRaw: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
  };
  const ctrl = new HealthController(prisma as any);
  await expect(ctrl.check()).rejects.toBeInstanceOf(
    ServiceUnavailableException,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/health/health.controller.spec.ts
```

Expected: FAIL — `HealthController` hoje não recebe Prisma e `check()` é síncrono.

- [ ] **Step 3: Write minimal implementation**

```ts
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('database unreachable');
    }
  }
}
```

`PrismaModule` já é `@Global()` e está no `AppModule`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/health/health.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Do not commit**

---

### Task 7: Headers de segurança no Next

**Files:**
- Create: `apps/web/src/lib/securityHeaders.ts`
- Create: `apps/web/src/lib/securityHeaders.test.ts`
- Modify: `apps/web/next.config.ts`

**Interfaces:**
- Consumes: nada
- Produces: `SECURITY_HEADERS: Array<{ key: string; value: string }>` aplicado em `/:path*`

Sem CSP neste corte: uma CSP errada derruba o OAuth do Privy. HSTS, frame, sniff, referrer, permissions.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/securityHeaders.test.ts`:

```ts
import { SECURITY_HEADERS } from './securityHeaders';

function value(key: string) {
  return SECURITY_HEADERS.find((header) => header.key === key)?.value;
}

it('denies framing and sniffing', () => {
  expect(value('X-Frame-Options')).toBe('DENY');
  expect(value('X-Content-Type-Options')).toBe('nosniff');
});

it('sends HSTS and a strict referrer policy', () => {
  expect(value('Strict-Transport-Security')).toBe(
    'max-age=63072000; includeSubDomains; preload',
  );
  expect(value('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
});

it('disables camera microphone and geolocation', () => {
  expect(value('Permissions-Policy')).toBe(
    'camera=(), microphone=(), geolocation=()',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @yield2pay/web exec vitest run src/lib/securityHeaders.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/lib/securityHeaders.ts`:

```ts
export const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next';
import path from 'path';
import { SECURITY_HEADERS } from './src/lib/securityHeaders';

const nextConfig: NextConfig = {
  transpilePackages: ['@yield2pay/shared'],
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @yield2pay/web exec vitest run src/lib/securityHeaders.test.ts
```

Expected: PASS.

- [ ] **Step 5: Do not commit**

---

### Task 8: Páginas de Termos e Privacidade + links

**Files:**
- Create: `apps/web/src/app/termos/page.tsx`
- Create: `apps/web/src/app/privacidade/page.tsx`
- Create: `apps/web/src/app/legalPages.test.tsx`
- Modify: `apps/web/src/app/login/page.tsx`
- Modify: `apps/web/src/app/login/login.test.tsx`
- Modify: `apps/web/src/app/page.tsx` (footer `href="#"`)
- Modify: `apps/web/src/app/landing.test.tsx`

**Interfaces:**
- Consumes: `SUPPORT_EMAIL` em `apps/web/src/lib/errorCopy.ts`
- Produces: rotas `/termos` e `/privacidade`; login e footer apontam para elas

Copy é rascunho operacional (produto não-custodial, dados via Privy, contato LGPD). Não é parecer jurídico — o Task 10 manda revisar com advogado antes do ar público.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/app/legalPages.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import TermosPage from './termos/page';
import PrivacidadePage from './privacidade/page';

it('renders terms with a contact email', () => {
  render(<TermosPage />);
  expect(screen.getByRole('heading', { name: /termos de uso/i })).toBeTruthy();
  expect(screen.getByText(/suporte@yield2pay.com.br/i)).toBeTruthy();
});

it('renders privacy with LGPD export and delete sections', () => {
  render(<PrivacidadePage />);
  expect(
    screen.getByRole('heading', { name: /política de privacidade/i }),
  ).toBeTruthy();
  expect(screen.getByText(/exportar/i)).toBeTruthy();
  expect(screen.getByText(/apagar/i)).toBeTruthy();
  expect(screen.getByText(/suporte@yield2pay.com.br/i)).toBeTruthy();
});
```

Em `login.test.tsx`:

```ts
it('links terms and privacy to real routes', () => {
  render(<LoginPage />);
  expect(screen.getByRole('link', { name: /termos/i }).getAttribute('href')).toBe(
    '/termos',
  );
  expect(
    screen.getByRole('link', { name: /privacidade/i }).getAttribute('href'),
  ).toBe('/privacidade');
});
```

Em `landing.test.tsx`:

```ts
it('footer legal links go to /termos and /privacidade', () => {
  render(<LandingPage />);
  expect(screen.getByRole('link', { name: 'Termos' }).getAttribute('href')).toBe(
    '/termos',
  );
  expect(
    screen.getByRole('link', { name: 'Privacidade' }).getAttribute('href'),
  ).toBe('/privacidade');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @yield2pay/web exec vitest run src/app/legalPages.test.tsx src/app/login/login.test.tsx src/app/landing.test.tsx
```

Expected: FAIL — rotas inexistentes; login é um `<p>` sem links; footer é `href="#"`.

- [ ] **Step 3: Write minimal implementation**

`termos/page.tsx` e `privacidade/page.tsx`: server components, `html` já é `pt-BR`. Layout mínimo: fundo `#0c0d0f`, texto `#EDEFF1`, largura 720px, `Link` para `/` e `/login`. Texto PT:

Termos — seções: Aceite; O que é o Yield2Pay (ferramenta de pagamento, não instituição financeira, rendimento variável); Conta (Google via Privy); Uso aceitável; Limitação de responsabilidade; Contato `suporte@yield2pay.com.br`; vigência 2026.

Privacidade — seções: Controlador Yield2Pay; dados (identificador Privy, e-mail do Google se o Privy enviar, bills, metadados de depósito); finalidade (conta e assinaturas); bases LGPD; retenção enquanto a conta existir; direitos (acesso, correção, exportação via `GET /account/export`, exclusão via `DELETE /account` se não houver depósito, oposição); compartilhamento (Privy, host da API/banco); cookies de sessão; contato `suporte@yield2pay.com.br`.

Login: o parágrafo `t.legal` vira JSX com dois `Link` do Next (`/termos`, `/privacidade`). Em EN: "Terms" → `/termos`, "Privacy Policy" → `/privacidade` (páginas só em PT neste corte).

Landing footer (~linha 1705): `href={i === 0 ? '/termos' : '/privacidade'}` no map de `footLegalLinks`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @yield2pay/web exec vitest run src/app/legalPages.test.tsx src/app/login/login.test.tsx src/app/landing.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Do not commit**

---

### Task 9: Exportar e apagar a Company

**Files:**
- Modify: `apps/api/src/company/company.service.ts`
- Modify: `apps/api/src/company/company.service.spec.ts`
- Create: `apps/api/src/account/account.controller.ts`
- Create: `apps/api/src/account/account.controller.spec.ts`
- Create: `apps/api/src/account/account.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/web/src/lib/api.ts` (`exportAccount`, `deleteAccount`)

**Interfaces:**
- Consumes: `CompanyService.findOrCreate`, Prisma models atuais
- Produces:
  - `CompanyService.exportAccount(companyId: string): Promise<CompanyAccountExport>`
  - `CompanyService.deleteAccount(companyId: string): Promise<void>`
  - `GET /account/export` (200 JSON)
  - `DELETE /account` (204)
  - Recusa com `ForbiddenException` se existir algum `Deposit` da company (não apagar conta com dinheiro registrado)

`CompanyAccountExport`:

```ts
export type CompanyAccountExport = {
  company: { id: string; privyUserId: string; createdAt: Date };
  bills: Array<{
    id: string;
    vendor: string;
    monthlyCost: string;
    type: string;
    status: string;
    createdAt: Date;
  }>;
  deposits: Array<{
    id: string;
    amount: string;
    txHash: string;
    createdAt: Date;
  }>;
};
```

Sem UI de settings neste corte (item high, fora de escopo). A privacidade descreve os endpoints; o suporte consegue cumprir LGPD. O front ganha os métodos no client para não ficar um contrato só no backend.

Não alterar FKs do Prisma: o delete é transação explícita na ordem filha → pai. Sem migration.

- [ ] **Step 1: Write the failing tests**

Estender `company.service.spec.ts` com um prisma mock mais completo só nesses testes (objeto local, não o `const prisma` do findOrCreate):

```ts
it('exportAccount returns company bills and deposits as strings', async () => {
  const prisma = {
    company: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 'co_1',
        privyUserId: 'did:privy:abc',
        createdAt: new Date('2026-01-01'),
      }),
    },
    recurringBill: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'b1',
          vendor: 'OpenAI',
          monthlyCost: 2000000n,
          type: 'software',
          status: 'active',
          createdAt: new Date('2026-01-02'),
        },
      ]),
    },
    deposit: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'd1',
          amount: 100n,
          txHash: 'abc',
          createdAt: new Date('2026-01-03'),
        },
      ]),
    },
  } as any;
  const svc = new CompanyService(prisma);
  const exported = await svc.exportAccount('co_1');
  expect(exported.bills[0].monthlyCost).toBe('2000000');
  expect(exported.deposits[0].amount).toBe('100');
});

it('deleteAccount refuses when deposits exist', async () => {
  const prisma = {
    deposit: { count: vi.fn().mockResolvedValue(1) },
    $transaction: vi.fn(),
  } as any;
  const svc = new CompanyService(prisma);
  await expect(svc.deleteAccount('co_1')).rejects.toBeInstanceOf(
    ForbiddenException,
  );
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

it('deleteAccount removes child rows then the company', async () => {
  const tx = {
    recurringBill: { deleteMany: vi.fn() },
    yieldSnapshot: { deleteMany: vi.fn() },
    rampOrder: { deleteMany: vi.fn() },
    etherfuseCustomer: { deleteMany: vi.fn() },
    wallet: { deleteMany: vi.fn() },
    deposit: { deleteMany: vi.fn() },
    company: { delete: vi.fn() },
  };
  const prisma = {
    deposit: { count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
  } as any;
  const svc = new CompanyService(prisma);
  await svc.deleteAccount('co_1');
  expect(tx.company.delete).toHaveBeenCalledWith({ where: { id: 'co_1' } });
});
```

`account.controller.spec.ts`: delega `export`/`remove` para o service com `companyId` do request (mesmo padrão de `wallet.controller.spec.ts`).

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/company/company.service.spec.ts src/account/account.controller.spec.ts
```

Expected: FAIL — métodos e módulo inexistentes.

- [ ] **Step 3: Write minimal implementation**

Em `CompanyService`:

- `exportAccount`: `findUniqueOrThrow` + `findMany` bills/deposits; mapear BigInt com `.toString()`.
- `deleteAccount`: `count` deposits; se `> 0`, `ForbiddenException('account has deposits; withdraw before deleting')`; senão `$transaction` na ordem: `recurringBill`, `yieldSnapshot`, `rampOrder`, `etherfuseCustomer`, `wallet`, `deposit` (no-op se 0), `company.delete`.

`AccountController`:

```ts
@Controller('account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly companies: CompanyService) {}

  @Get('export')
  export(@Req() req: AuthenticatedRequest) {
    return this.companies.exportAccount(req.companyId);
  }

  @Delete()
  @HttpCode(204)
  remove(@Req() req: AuthenticatedRequest) {
    return this.companies.deleteAccount(req.companyId);
  }
}
```

`AccountModule` importa `AuthModule` (exporta `CompanyModule`) e declara o controller.

`AppModule` importa `AccountModule`.

`api.ts`:

```ts
exportAccount(): Promise<unknown>;
deleteAccount(): Promise<void>;
// ...
exportAccount: () => request('/account/export'),
deleteAccount: () => request('/account', 'DELETE'),
```

Não precisa tipo compartilhado rígido neste corte — `unknown` no client evita inflar `packages/shared`. Se o implementer preferir, copiar `CompanyAccountExport` para shared; não é obrigatório para o blocker.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @yield2pay/api exec vitest run src/company/company.service.spec.ts src/account/account.controller.spec.ts
pnpm --filter @yield2pay/web exec vitest run src/lib/api.test.ts
```

Expected: PASS. Se `api.test.ts` enumerar métodos, incluir os dois novos.

- [ ] **Step 5: Do not commit**

---

### Task 10: Infra — yaml + runbook (humano no dashboard)

**Files:**
- Modify: `render.yaml`
- Modify: `docs/DEPLOY.md`
- Modify: `apps/api/.env.example` (já comentado no Task 1; conferir)

Este task **não** sobe o plano sozinho. O yaml declara a intenção; o humano confirma no Render/Vercel/Privy porque cartão e DNS não cabem no Vitest.

- [ ] **Step 1: Change render.yaml production defaults**

```yaml
databases:
  - name: yield2pay-db
    plan: basic-256mb
    databaseName: yield2pay
    user: yield2pay

services:
  - type: web
    name: yield2pay-api
    runtime: docker
    dockerfilePath: ./apps/api/Dockerfile
    dockerContext: .
    plan: starter
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: yield2pay-db
          property: connectionString
      - key: STELLAR_NETWORK
        value: testnet
      - key: APP_ENV
        value: production
      - key: DEFINDEX_BASE_URL
        value: https://api.defindex.io
      - key: SOROBAN_RPC_URL
        value: https://soroban-testnet.stellar.org
      - key: CORS_ORIGIN
        sync: false
      - key: PRIVY_APP_ID
        sync: false
      - key: PRIVY_APP_SECRET
        sync: false
      - key: DEFINDEX_API_KEY
        sync: false
      - key: VAULT_ADDRESS
        sync: false
      - key: USDC_ADDRESS
        sync: false
      - key: FEE_SPONSOR_SECRET_KEY
        sync: false
```

`plan: starter` no web = legado ainda válido no Blueprint; equivalente atual `0.5c-512mb` se o dashboard recusar o nome. `basic-256mb` é o Postgres pago de entrada (não `free`).

- [ ] **Step 2: Replace docs/DEPLOY.md section 2–3 with this checklist**

Colar no lugar de “2. Backend → Render” e “3. After both are up”:

```markdown
## 2. Backend → Render (`apps/api`)

Blueprint no repo. Depois do primeiro deploy, no dashboard:

1. Postgres **não** pode ficar `free`. Conferir plano `basic-256mb` (ou maior) e backups automáticos ligados. Fazer um restore de teste uma vez.
2. Web service **não** pode ficar `free` (dorme e o `/health` falha no despertar). Plano `starter` / `0.5c-512mb` ou maior.
3. Env obrigatória:
   - `APP_ENV=production` (o blueprint já manda isso; conferir se um override antigo ficou `staging`)
   - `CORS_ORIGIN=https://<dominio-vercel>` (sem barra no fim; várias origens separadas por vírgula)
   - `PRIVY_APP_ID`, `PRIVY_APP_SECRET`
   - `DATABASE_URL` (Render injeta)
   - Segredos web3 que o `loadEnv` ainda exige no boot (`DEFINDEX_*`, `VAULT_ADDRESS`, `USDC_ADDRESS`, `FEE_SPONSOR_SECRET_KEY`, `STELLAR_NETWORK`, `SOROBAN_RPC_URL`) — valores de testnet servem para o processo subir; este plano não liga mainnet.
4. Confirmar `GET https://<api>/health` → `{"status":"ok"}` com o banco no ar. Parar o Postgres de staging uma vez e ver o health virar 503.

## 3. Frontend → Vercel + Privy

Além do `NEXT_PUBLIC_PRIVY_APP_ID` e `NEXT_PUBLIC_API_BASE_URL`:

- `NEXT_PUBLIC_APP_ENV=production` em Production (sem isso o default do front é `development`).
- No dashboard Privy: origem `https://<dominio-vercel>` e previews `https://*.vercel.app` se forem usar login em preview.
- `CORS_ORIGIN` da API tem que ser **o mesmo** origin do Privy (scheme + host, sem path).

## 4. Legal (humano)

Rascunho de `/termos` e `/privacidade` está no repo. Advogado revisa antes de anúncio público. Pedidos LGPD: `GET /account/export` e `DELETE /account` (este último recusa se houver depósito).
```

- [ ] **Step 3: Human gate (não automatizar)**

O implementer (humano) marca à mão:

- [ ] Render Postgres pago + backup
- [ ] Render API não-free
- [ ] `CORS_ORIGIN` preenchido
- [ ] `APP_ENV=production` na API
- [ ] `NEXT_PUBLIC_APP_ENV=production` na Vercel
- [ ] Origens Privy
- [ ] `/health` ok no domínio real
- [ ] Advogado viu termos/privacidade

- [ ] **Step 4: Do not commit until the yaml/docs change is ready; agent still does not commit**

---

## Self-review

**Spec coverage (blockers do canvas):**

| Item | Task |
|---|---|
| CORS falha fechado | 1 |
| CORS_ORIGIN no Render | 10 |
| Bearer no log | 2 |
| APP_ENV production nos hosts | 10 |
| Sandbox KYC/simulate | 3 |
| Validar bills | 4 |
| Rate limit | 5 |
| Headers Next | 7 |
| /health no Postgres | 6 |
| Postgres pago + backup + API acordada | 10 |
| Exportar/apagar conta | 9 |
| Termos e privacidade | 8 |

**Fora de propósito (high/soon):** CI, Sentry, modelo extra de bills, Acme/nav morta, Apple, `.env.example` do web (só o da API no Task 1), cron, PgBouncer, `/family`.

**Placeholders:** nenhum TBD. CSP foi uma decisão (não vai neste corte), não um buraco.

**Tipos:** `Env.corsOrigins`, `assertSandboxEnabled`, `CreateBillBody`, `allowRequest`, `CompanyAccountExport`, `429` em `ErrorStatusCode` — usados com os mesmos nomes nas tasks seguintes.
