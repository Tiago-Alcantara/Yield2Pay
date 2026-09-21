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
