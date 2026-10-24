# Onboarding de primeiro acesso — Design Spec

**Date:** 2026-10-21
**Area:** `apps/api` (household), `packages/shared`, `apps/web` (`/family/dashboard`)
**Replaces:** the four-question modal in `apps/web/src/app/family/dashboard/Onboarding.tsx`

## Goal

The first time a household opens the expense panel, the person sees a full-screen React flow based on `Onboarding.html`: name, goals, how they want to bring expenses in, crypto familiarity, crypto experience when it applies, and a result screen. Finishing saves the answers on the account and turns on only the panel pieces that already exist.

The screen uses the family visual language (radial background, metal cards, chrome button, Geist Mono). It is not the bundled HTML dropped into the app.

## Decisions

- The flow replaces the current questions (household size, income, reserve, what freedom means, crypto interest). Those fields stay in the database for households that already filled them. This flow does not write them.
- The flow opens on `/family/dashboard` when `onboardingCompleted` is false, including right after the household is created. `/family/onboarding` (login, wallet, first PIX) stays as it is.
- The name belongs to the person. Goals, import preference, crypto answers, and the three switches belong to the household. Completing the flow completes it for the whole household. Any member can complete it, same as today.
- The level is derived. It is not stored.
- The server derives `cryptoExperience` from the answers and the "Aprender cripto" switch. The client does not choose `beginner`, `fund`, or `declined` directly on finish.
- Freedom months still need reserve and goal. With freedom on and those values empty, the panel keeps showing "—".
- Existing households receive the new flags as on. The old local freedom preference stops being the source of truth. Someone who had hidden freedom only in this browser sees the section again and can turn it off in Settings, which now saves on the household.

## What this version does not build

- Crypto balance on the expense panel.
- Stablecoins inside the reserve or the freedom math.
- A read-only view of a self-custody address.
- New questions for income, reserve, household size, or freedom goal.
- A change to `/family/onboarding`.

Those three crypto rows appear on the result screen as released or locked. They have no switch and no effect on the panel.

## Modules

| Module | Responsibility | Depends on |
|---|---|---|
| `onboarding-model.ts` | Options, step order, validation, level, unlocks, default switches, request body | none |
| `Onboarding.tsx` | Full-screen shell, steps, back, next, skip | model, family theme |
| `OnboardingResult.tsx` | Level, the two groups, switches, finish and redo | model |
| `POST /household/onboarding` | Validate, save household answers, set `onboardingCompleted`, update the person name when one was given | `AuthGuard`, membership |
| Household profile read | Return the new fields | Prisma |
| Panel and Settings | Read and update freedom, family invite, and the lesson track | profile |

`PUT /household/profile` and `POST /household/profile/skip` stay for existing callers. This flow does not call them.

## Data model

New columns on `Household`. Existing columns are unchanged.

```
goals                 string[]   default []
importMode            ofx | nfe | manual, null
cryptoFamiliarity     nunca | ouvi | comprei | frequente, null
cryptoActions        string[]   default []
showFreedom           bool       default true
showFamily            bool       default true
```

`cryptoExperience` stays `beginner | fund | declined` and is written when the flow completes.

`PersonName.fullName` receives the name typed in "como você se chama" (max 32). `PersonName.displayName` receives the nickname, or the first word of the full name when the nickname is empty (max 32, same cap the account patch already uses). The nickname field itself rejects more than 24 characters. Skipping without a name does not clear a name already stored.

Allowed `goals`: `gastos`, `reserva`, `familia`, `aprender`, `investir`.

Allowed `cryptoActions`: `corretora`, `transferi`, `stable`, `rendimento`, `autocustodia`.

## Copy

Goals, one or more:

| id | title | description |
|---|---|---|
| `gastos` | Organizar os gastos da casa | Ver para onde o dinheiro vai, mês a mês. |
| `reserva` | Construir uma reserva | Saber quantos meses a casa se sustenta sem renda. |
| `familia` | Dividir com a família | Um painel só, cada pessoa com seu e-mail. |
| `aprender` | Entender cripto | Aulas curtas, sem jargão, no seu ritmo. |
| `investir` | Acompanhar minhas criptos | Ver suas moedas ao lado dos gastos. |

Import, one:

| id | tag | title | description |
|---|---|---|---|
| `ofx` | Mais completo | Extrato do banco | Arquivo OFX, CSV ou PDF com os gastos do mês. |
| `nfe` | Mais detalhado | Nota fiscal | Uma compra por vez, pela chave de acesso da nota. |
| `manual` | Mais simples | Manual | Você digita cada gasto, do seu jeito. |

The bank option names OFX, CSV, and PDF because that is what import already accepts.

Familiarity, one:

| id | title | description |
|---|---|---|
| `nunca` | Nunca mexi | Sei pouco ou nada sobre o assunto. |
| `ouvi` | Já ouvi falar | Entendo a ideia, mas nunca comprei. |
| `comprei` | Já comprei | Tenho ou já tive cripto em alguma corretora. |
| `frequente` | Uso com frequência | Compro, transfiro e acompanho com regularidade. |

Experience, any number, only after `comprei` or `frequente`:

| id | title | description |
|---|---|---|
| `corretora` | Comprei em corretora | Mercado Bitcoin, Binance, Foxbit ou similar. |
| `transferi` | Transferi entre carteiras | Já mandei cripto de um lugar para outro. |
| `stable` | Uso dólar digital | Guardo parte em stablecoin, como USDT ou USDC. |
| `rendimento` | Recebo rendimento sobre cripto | Staking, empréstimo ou produto parecido. |
| `autocustodia` | Tenho carteira própria | Guardo as chaves fora da corretora. |

Level descriptions avoid promising panel features this version does not build:

| level | number | name | description |
|---|---|---|---|
| `fora` | 1 | Foco no essencial | Começamos pelos gastos e pela reserva. Cripto fica guardado até você querer. |
| `curioso` | 2 | Começando em cripto | Você recebe a trilha do zero: aulas curtas, uma ideia por vez. |
| `praticante` | 3 | Já pratica | A trilha começa de onde você já está. Cripto no painel fica para uma próxima versão. |
| `avancado` | 4 | Avançado | A trilha de quem já conhece fica ligada. Reserva em dólar digital e carteira própria ficam para uma próxima versão. |

## Rules

Let familiarity index be 0 `nunca`, 1 `ouvi`, 2 `comprei`, 3 `frequente`, and -1 when it is empty. Mature means index >= 2. Interest means goals contain `aprender` or `investir`. Experience answers count only when mature; otherwise they are treated as empty, and the server stores `[]`.

Level:

- `fora` when index <= 0 and there is no interest. That includes a skipped familiarity.
- `curioso` when index is 0 or 1 and the `fora` case did not match.
- `avancado` when index is 3, or the counted actions include `rendimento` or `autocustodia`.
- `praticante` otherwise (`comprei` without those two actions).

Default switches, before the person touches them on the result screen:

- Freedom on when goals contain `reserva` or goals are empty.
- Family invite on when goals contain `familia`.
- Learn crypto on when there is interest or the familiarity index is >= 1.

`cryptoExperience` on finish:

- `declined` when learn crypto is off.
- `fund` when learn crypto is on and the level is `praticante` or `avancado`.
- `beginner` when learn crypto is on in every other case, including `fora` if the person turns the switch on.

Informational unlocks, not stored:

- Crypto on the panel: mature.
- Digital-dollar reserve: index is 3, or counted actions include `stable` or `rendimento`.
- Own wallet: counted actions include `autocustodia`.

Visible question steps are name, goals, import, familiarity, then experience only when mature. The result is not a question. The header reads `Pergunta N de M` with M equal to the question count. After a familiarity change that drops experience, that step disappears and its answers are ignored.

A step can continue when:

- Name has at least 2 characters after trim.
- At least one goal is selected.
- An import mode is selected.
- A familiarity is selected.
- Experience is always allowed, including an empty selection.

Skip jumps to the result with whatever is already filled and does not mark the household complete. Redo returns to goals and keeps the answers. Closing or refreshing before finish drops the in-memory draft and shows the flow again.

## Screen

Full viewport, family radial background, header with `FamilyBrand`, the progress segments, and "Pular por agora" while a question is showing. Content column max 620px.

1. **Name.** Kicker "Boas-vindas". Title "Primeiro, como você se chama?". Subtitle "O nome aparece para o seu grupo. O apelido é como a gente fala com você." Fields "Nome" (placeholder "Seu nome") and "Como prefere ser chamado". Hint uses the nickname, or the first name when the nickname is empty.
2. **Goals.** Title "O que você quer resolver primeiro?". Subtitle "Marque quantos quiser. Isso define o que aparece no seu painel." When a nickname or first name exists, a line above the title says "Olá, {nome}". With no name, that line is absent.
3. **Import.** Title "Como prefere trazer seus gastos?". Subtitle "Essa vira a forma principal no painel. As outras continuam disponíveis."
4. **Familiarity.** Kicker "Sobre cripto". Title "Quanto você já sabe de cripto?". Subtitle "Sem resposta certa. Usamos isso para não mostrar nem de menos, nem de mais."
5. **Experience.** Kicker "Sua experiência". Title "O que você já fez com cripto?". Subtitle "Marque o que se aplica. Algumas respostas liberam ferramentas novas."
6. **Result.** Kicker "Tudo pronto". Title "Seu painel está montado, {nome}." when a nickname or first name exists, and "Seu painel está montado." when it does not. Subtitle "Ligamos o que faz sentido para o que você contou. Dá para mudar tudo depois em Configurações."

On familiarity and experience, a preview sits under the options. With crypto in play it says "Com essas respostas, você libera" and lists the unlocked chips (trail label, crypto on the panel, digital-dollar reserve, own wallet). With level `fora` it says "Cripto fica de fora por enquanto. Dá para ligar depois em Configurações."

The result has two groups:

- **Essenciais.** Expense panel, always on, no switch. Description names the chosen import in lowercase ("extrato do banco", "nota fiscal", "manual"); when import was skipped, say "extrato do banco" as the current default. Freedom and family invite have working switches.
- **Cripto.** "Aprender cripto" has a working switch. Trail copy is "Trilha do zero: o que é, para que serve e como não cair em golpe." unless the level is `praticante` or `avancado`, in which case it is "Trilha para quem já conhece: carteiras, taxas e riscos." The other three rows show "Liberado" or their lock hint and cannot be toggled.

Footer on questions: "Voltar" when not on the first question, and "Continuar", or "Ver meu painel" on the last question. The forward button is disabled until the step is valid. Enter on the name step continues when the name is valid. Result actions are "Refazer perguntas" and "Ir para o painel".

Styles live in `apps/web/src/app/family/dashboard/onboarding.css`, imported by the flow, and use the existing `y2p` class pattern and `familyTheme` tokens. No design-tool markup and no copied font files.

## API

`POST /household/onboarding`, authenticated, any member of the household.

```
{
  fullName: string | null
  displayName: string | null
  goals: string[]
  importMode: "ofx" | "nfe" | "manual" | null
  cryptoFamiliarity: "nunca" | "ouvi" | "comprei" | "frequente" | null
  cryptoActions: string[]
  showFreedom: boolean
  showFamily: boolean
  learnCrypto: boolean
}
```

Invalid enum values, unknown ids, or a non-boolean switch return 400 and change nothing. The handler trims names, drops experience when familiarity is not mature, derives `cryptoExperience`, sets `onboardingCompleted` to true, and leaves income, reserve, household size, goal months, and priorities untouched.

The client sends `displayName` as the nickname, or the first word of the full name when the nickname is empty. The server stores that trimmed `displayName` when it is non-empty, otherwise the first word of `fullName`. When both are empty after trim, it skips the person update and leaves any stored name as it is. `fullName` is written only when it is non-empty after trim. The person update runs before the household update. If the name write fails, the household is not completed. If the household write fails, the name that was saved stays and the client can retry.

`GET /household/profile` adds the six new fields. `HouseholdProfile` in `packages/shared` matches. `PATCH /account` stays as it is. Settings keeps saving the display name through it.

## Panel behavior

`PainelGastos` still opens the flow when the household is not completed. On success it stores the returned account when a name was saved, reloads the profile, reloads lessons for the derived track, writes the local freedom preference to the same value, and closes the flow.

Freedom section and its nav item follow `profile.showFreedom`. The owner invite block follows `profile.showFamily`. The learn nav item and the lesson block follow `cryptoExperience`, as they do today (`declined` hides the nav item and shows the "when it makes sense" state).

Settings, Aulas tab: the freedom switch patches `showFreedom` and updates the local preference. The lesson-track switch keeps patching `cryptoExperience`. Settings, Grupo tab: a switch "Convite no painel" patches `showFamily`. The group screen itself stays available either way.

`ImportModal` opens on `profile.importMode` when it is set, and on `ofx` when it is null.

## Errors

Finish shows the failure on the result screen, keeps both actions usable, and leaves `onboardingCompleted` false. A load failure of the dashboard follows the current path: show the panel and do not open the flow.

## Tests

- Model: experience is absent for `nunca`, `ouvi`, and empty familiarity; levels 1–4; default switches; `cryptoExperience` for the switch on and off; skipped answers produce `fora`, freedom on, family off, learn off.
- Screen: a one-character name does not advance; skip lands on the result; "Ir para o painel" sends the body above; a failed request stays on the result.
- API: valid completion writes the new columns, derives `cryptoExperience`, sets `onboardingCompleted`, and does not change income, reserve, or goal months. Mature-only actions are cleared. A bad id returns 400. An empty display name does not clear `PersonName`.

Dashboard tests that already mark onboarding complete stay on the panel and do not need the new steps.
