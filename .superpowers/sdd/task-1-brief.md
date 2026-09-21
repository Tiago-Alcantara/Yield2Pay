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
