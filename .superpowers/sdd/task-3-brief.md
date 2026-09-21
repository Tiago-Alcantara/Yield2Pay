### Task 3: Desligar rotas de sandbox em production

**Files:**
- Create: `apps/api/src/common/assert-sandbox.ts`
- Create: `apps/api/src/common/assert-sandbox.spec.ts`
- Create: `apps/api/src/ramp/ramp.controller.spec.ts`
- Modify: `apps/api/src/ramp/ramp.controller.ts`

**Interfaces:**
- Consumes: `Env.appEnv`
- Produces: `assertSandboxEnabled(appEnv: AppEnv): void` — no-op fora de production; `ForbiddenException` em production

Do not change env.ts (Task 1 already added corsOrigins). Keep every other RampController method unchanged.

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

```bash
pnpm --filter @yield2pay/api exec vitest run src/common/assert-sandbox.spec.ts src/ramp/ramp.controller.spec.ts
```

If pnpm is not on PATH, use `node apps/api/node_modules/vitest/vitest.mjs` from apps/api, or `node node_modules/vitest/vitest.mjs` from repo root with filter paths. Expected: FAIL — files missing; RampController today only takes RampService.

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

In `ramp.controller.ts`, add Inject/APP_CONFIG/Env/assertSandboxEnabled. Constructor becomes `(ramp, @Inject(APP_CONFIG) config: Env)`. In `markKycApproved` and `simulateFiatReceived` only: call `assertSandboxEnabled(this.config.appEnv)` before the service. Keep all other methods identical.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @yield2pay/api exec vitest run src/common/assert-sandbox.spec.ts src/ramp/ramp.controller.spec.ts src/ramp/ramp.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Do not commit**
