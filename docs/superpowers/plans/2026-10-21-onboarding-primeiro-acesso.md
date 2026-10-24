# Onboarding de primeiro acesso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the first-access expense questionnaire with the full-screen React flow from the onboarding spec, and save the answers on the person and the household.

**Architecture:** Pure level, unlock, and default-switch rules live in `@yield2pay/shared` so the result screen and `POST /household/onboarding` cannot disagree. The web model adds Portuguese copy and the request body. The dashboard opens the flow when `onboardingCompleted` is false. Freedom, the family invite, and the lesson track are the only panel switches that take effect.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, Vitest, Next.js 16, React, `@yield2pay/shared`.

## Global Constraints

- Do not change `/family/onboarding` (login, wallet, PIX).
- Do not write `householdSize`, `monthlyIncomeCents`, `reserveCents`, `goalMonths`, or `priorities` from this flow.
- Do not build crypto-on-the-panel, stablecoin reserve, or a read-only own wallet.
- The server derives `cryptoExperience`. The client sends `learnCrypto`, not `beginner` / `fund` / `declined`.
- Familiarity index: `nunca` 0, `ouvi` 1, `comprei` 2, `frequente` 3, empty -1. Mature means index >= 2.
- Level `fora` when index <= 0 and goals lack `aprender` and `investir`. `curioso` when index <= 1 otherwise. `avancado` when index is 3 or counted actions include `rendimento` or `autocustodia`. `praticante` otherwise.
- Counted actions are empty unless mature. The server stores `[]` in that case.
- Default switches: freedom on when goals contain `reserva` or goals are empty; family on when goals contain `familia`; learn on when there is crypto interest or familiarity index >= 1.
- `cryptoExperience`: `declined` when learn is off; `fund` when learn is on and the level is `praticante` or `avancado`; `beginner` otherwise.
- Full name max 32. Nickname field max 24. Display name max 32: nickname, else the first word of the full name. Both empty skips the person update.
- Existing households default `showFreedom` and `showFamily` to true.
- A failed finish stays on the result screen and leaves `onboardingCompleted` false.
- Copy and step order are the spec's, including OFX, CSV, and PDF on the bank option.

---

## File structure

- `packages/shared/src/onboarding.ts` — ids, level, unlocks, defaults, derived track.
- `packages/shared/src/household.ts` — profile fields and `PatchHouseholdProfile`.
- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20261021120000_household_onboarding/migration.sql` — six columns.
- `apps/api/src/household/household.service.ts` — `completeOnboarding`, profile read, flag patch.
- `apps/api/src/household/household.controller.ts` — `POST /household/onboarding`.
- `apps/web/src/app/family/dashboard/onboarding-model.ts` — copy, steps, request body.
- `apps/web/src/app/family/dashboard/Onboarding.tsx` — full-screen questions.
- `apps/web/src/app/family/dashboard/OnboardingResult.tsx` — result groups.
- `apps/web/src/app/family/dashboard/onboarding.css` — layout.
- `PainelGastos.tsx`, `ImportModal.tsx`, `ContaModal.tsx`, `householdApi.ts` — wire the flow and the three real switches.

---

### Task 1: Shared rules

**Files:**
- Create: `packages/shared/src/onboarding.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/web/src/app/family/dashboard/onboarding-model.test.ts` (imports the shared functions through the web model)

**Interfaces:**
- Produces: `OnboardingGoal`, `ImportMode`, `CryptoFamiliarity`, `CryptoAction`, `OnboardingLevel`, `OnboardingSwitches`, `questionSteps`, `onboardingLevel`, `defaultSwitches`, `cryptoExperienceFor`, `unlocks`, `isMature`

- [ ] **Step 1: Write the failing model test** for hidden experience, levels 1–4, default switches, and derived `cryptoExperience`.
- [ ] **Step 2: Run** `pnpm --filter @yield2pay/web exec vitest run src/app/family/dashboard/onboarding-model.test.ts` and confirm FAIL.
- [ ] **Step 3: Implement** `packages/shared/src/onboarding.ts` and re-export it.
- [ ] **Step 4: Re-run the test** and confirm PASS.

### Task 2: Persist onboarding

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `household.service.ts`, `household.controller.ts`, `packages/shared/src/household.ts`
- Create: `apps/api/prisma/migrations/20261021120000_household_onboarding/migration.sql`
- Test: `apps/api/src/household/household.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 functions
- Produces: `POST /household/onboarding` body `CompleteOnboarding`, response `AccountView`. `GET /household/profile` adds `goals`, `importMode`, `cryptoFamiliarity`, `cryptoActions`, `showFreedom`, `showFamily`. `PATCH /household/profile` accepts `showFreedom` and `showFamily`.

- [ ] **Step 1: Add failing service tests** for a valid completion, cleared immature actions, a bad goal id, and an empty name.
- [ ] **Step 2: Run** `pnpm --filter @yield2pay/api exec vitest run src/household/household.service.spec.ts` and confirm the new tests FAIL.
- [ ] **Step 3: Add columns, `completeOnboarding`, profile mapping, and the route.** Invalid input throws `HouseholdInvalidError` before any write and the controller returns 400.
- [ ] **Step 4: Re-run the service tests** and confirm PASS.

### Task 3: React flow

**Files:**
- Create: `onboarding-model.ts`, `OnboardingResult.tsx`, `onboarding.css`, `Onboarding.test.tsx`
- Modify: `Onboarding.tsx`, `householdApi.ts`, `PainelGastos.tsx`, `ImportModal.tsx`, `ContaModal.tsx`

**Interfaces:**
- Consumes: `CompleteOnboarding` and Task 1 rules
- Produces: `<Onboarding onSave onFinish initial?>`. `onSave` receives `CompleteOnboarding`. `createHouseholdApi().completeOnboarding`.

- [ ] **Step 1: Write the failing screen test:** one character does not enable Continuar; skip shows "Seu painel está montado."; finish sends the skipped body; a rejected save stays on the result.
- [ ] **Step 2: Run** `pnpm --filter @yield2pay/web exec vitest run src/app/family/dashboard/Onboarding.test.tsx` and confirm FAIL.
- [ ] **Step 3: Build the screen** in the family visual language and connect save, freedom, the invite block, the lesson track, settings switches, and the import tab.
- [ ] **Step 4: Re-run** the onboarding tests plus `family.test.tsx` and `conta.test.tsx`.

### Task 4: Verify

- [ ] **Step 1: Run** `pnpm --filter @yield2pay/api exec vitest run src/household/household.service.spec.ts` and `pnpm --filter @yield2pay/web exec vitest run src/app/family/dashboard/onboarding-model.test.ts src/app/family/dashboard/Onboarding.test.tsx src/app/family/family.test.tsx src/app/family/conta/conta.test.tsx`.
- [ ] **Step 2: Generate the Prisma client** with `pnpm --filter @yield2pay/api exec prisma generate`.
