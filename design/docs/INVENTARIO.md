# Inventário do design system × app

> Gerado por `pnpm design:sync` (scripts/design-sync.mjs). **Não edite à mão.**
> Use como fonte de verdade ao criar telas/campos novos: reaproveite os tokens e componentes abaixo.

## Tokens
- Definidos em `design/tokens`: **101**
- Definidos no CSS do app: **106** (inclui `--fam-*`, locais do app)
- Arquivos de `apps/web/src/app/tokens` diferentes de `design/tokens`: _nenhum_

### Usados no app mas sem definição (bug)
_nenhum_

### Só no app (candidatos a subir para design/tokens)
- `--fam-card-pad`
- `--fam-card-pad-lg`
- `--fam-gutter`
- `--fam-metal-pad`
- `--fam-panel-pad`

### Só no design (não usados/definidos no app)
_nenhum_

## Componentes do app
Presentes em `apps/web/src/components`. Marcados com ⚠ quando não há espelho em `design/components`.

- `BackButton` ⚠ sem espelho no design
- `Badge`
- `BrandHeader` ⚠ sem espelho no design
- `Button`
- `ErrorDialog` ⚠ sem espelho no design
- `ErrorPage` ⚠ sem espelho no design
- `Header`
- `Input`
- `MetalCard`
- `MoveDrawer` ⚠ sem espelho no design
- `ProgressBar`
- `SegmentedControl`
- `TechnicalPanel` ⚠ sem espelho no design
- `Toggle` ⚠ sem espelho no design
- `TxErrorBox` ⚠ sem espelho no design
- `TxResultCard` ⚠ sem espelho no design

## Telas do app
- `/`
- `/dashboard`
- `/deposit`
- `/family`
- `/family/aprender`
- `/family/conceitos`
- `/family/configuracoes`
- `/family/conta`
- `/family/dashboard`
- `/family/dashboard/[subId]`
- `/family/deposito`
- `/family/onboarding`
- `/family/saque`
- `/login`
- `/withdraw`

UI kits em `design/ui_kits`: `yield2pay-dashboard`, `yield2pay-deposit`, `yield2pay-landing`.
Telas sem kit correspondente devem ser documentadas em `design/ui_kits/` ao serem estabilizadas.
