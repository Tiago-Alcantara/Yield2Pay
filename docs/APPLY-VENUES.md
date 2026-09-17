# Aplicar no Yield2Pay (git real)

Este diretório é o **overlay** da execução no worktree do agente. O clone em `.worktrees/Yield2Pay` **não** vai para o Origin desta sessão.

## Onde correr o script

Tem de ser **no teu PC**, num terminal que veja as duas pastas:

1. Este repo de arquitetura (branch `cursor/multi-chain-arquitetura-6cec`)
2. O clone real `C:\Users\Tiago\projetos\Yield2Pay`

O terminal `workspace $` do Cloud Agent é Linux na nuvem. Lá, `/c/Users/Tiago/projetos/Yield2Pay` **não existe** — por isso o script responde só `uso:`.

### Git Bash no Windows (recomendado)

Não uses PowerShell para `./scripts/apply-to-yield2pay.sh` — o PowerShell não corre `.sh`.

Abre **Git Bash** (não o terminal azul do Windows):

```bash
cd ~/projetos/omni-yield
./scripts/apply-to-yield2pay.sh "$HOME/projetos/Yield2Pay"
```

### PowerShell (Windows)

Na pasta do `omni-yield`:

```powershell
cd $HOME\projetos\omni-yield
.\scripts\apply-to-yield2pay.ps1 "$HOME\projetos\Yield2Pay"
```

O `.ps1` só chama o Git Bash por baixo. Precisas do [Git for Windows](https://git-scm.com/download/win).

Confirma o destino antes:

```bash
ls "/c/Users/Tiago/projetos/Yield2Pay/package.json"
```

Depois, no Yield2Pay:

```bash
pnpm install
pnpm db:generate
# se a DB local estiver no ar:
pnpm --filter @yield2pay/api exec prisma migrate dev
pnpm --filter @yield2pay/api test
pnpm --filter @yield2pay/web test
```

## O que o script copia

- `packages/venue-core`
- `venues/stellar-blend`
- `venues/solana-kamino`
- `apps/api/src/venue/*` (Nest: registry no boot, rotas `/venues`, `/account/chain`)
- `apps/api/src/config/env.ts` (lê `VENUE_MODE` / `STELLAR_VENUE_MODE` / `SOLANA_VENUE_MODE`)
- migration Prisma `selected_chain` + `unlocked_chains` + `solana_address`
- `apps/web/src/lib/useVenueTx.ts`

O script também acrescenta `venues/*` ao `pnpm-workspace.yaml` e as deps workspace na API, se ainda não existirem.

## Env

```
VENUE_MODE=mock
# STELLAR_VENUE_MODE=live   # usa DeFindex + fee-bump via StellarDefindexLiveAdapter
# SOLANA_VENUE_MODE=mock
```

Sem env = mock. **Live Solana/Kamino** ainda precisa do adapter (não copiamos `@solana/web3.js` neste corte).

## Rotas novas

| Método | Path |
|--------|------|
| GET | `/venues` |
| POST | `/venues/:chain/:protocol/deposit/build` |
| POST | `/venues/:chain/:protocol/deposit/submit` |
| POST | `/venues/:chain/:protocol/withdraw/build` |
| POST | `/venues/:chain/:protocol/withdraw/submit` |
| GET | `/account/chain` |
| POST | `/account/chain` body `{ action: "unlock" \| "select", chainId }` |

`:chain/:protocol` = `stellar/blend` ou `solana/kamino` (o `:` do VenueId não vai na URL).

Depósito/saque **antigos** (`/deposit`, `/withdraw`) continuam; o produto novo fala só com o registry.

## Produto (family vs PIX)

- **Venues:** `/family/investir`, `/family/sacar-cofre` e o `MoveDrawer` no dashboard usam o registry (`/venues/...` via `useVenueTx`).
- **Legacy:** PIX (ramp) e as rotas `/deposit` / `/withdraw` mantêm o fluxo antigo (DeFindex directo na API), fora do registry.

## Segredos

Não copies `.env` do worktree. Fee sponsor e Privy ficam no Yield2Pay.
