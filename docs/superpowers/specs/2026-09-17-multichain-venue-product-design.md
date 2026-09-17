# MultChain venue product — Design

**Date:** 2026-09-17  
**Branch:** `MultChain`  
**Repo:** `Tiago-Alcantara/Yield2Pay`  
**Status:** Approved (option A — família invest routes)

## Goal

Refactor the **existing product** so family + wallet→vault invest flows talk only to the **venue registry**, without the UI knowing DeFindex/XDR/Solana SDKs. Overlay already present; this is adoption, not another copy from Origin.

## Closed decisions

| Topic | Decision |
|-------|----------|
| Architecture | Plugin per protocol. Product plan (Família/B2B) separate from chain venues. |
| Repo | Same git, pnpm workspaces. No submodule. |
| Default account | `selectedChain = stellar`, `unlockedChains = [stellar]` |
| Money this cut | Direct wallet transfer. No PIX / Etherfuse / anchor in this refactor. |
| Unlock | Dumb list: unlocked chains + selected. No course/XP/vault choice. |
| Mock vs live | `VENUE_MODE` / `STELLAR_VENUE_MODE` / `SOLANA_VENUE_MODE` (`mock` \| `live`). Mock is not a plugin. |
| Order | (1) product → registry (2) Stellar live via adapter (3) Solana mock; live Kamino later |
| Família invest | **Option A:** new `/family/investir` + vault withdraw route via `useVenueTx`; PIX pages stay |

## Out of scope

PaymentEngine, Chain Gateway, APY router, Polygon, unify XDR with `VersionedTransaction`, mix USDC 6 vs 7 decimals as one ledger, live Kamino, deleting PIX/Etherfuse or legacy `/deposit`/`/withdraw`.

## Current state

- Present: `packages/venue-core`, `venues/stellar-blend`, `venues/solana-kamino`, Nest `VenueModule`, `useVenueTx`, Prisma chain fields, `StellarDefindexLiveAdapter`.
- Still legacy: `MoveDrawer` → `useStellarTx` → `/deposit`/`/withdraw`; família PIX mock only; `Deposit` has no `venueId`; `ledger.recordDeposit` is company-global.

## Design

### 1. Session venue resolution (web)

1. Call `GET /account/chain`.
2. Map: `stellar` → `{ chain: 'stellar', protocol: 'blend' }`; `solana` → `{ chain: 'solana', protocol: 'kamino' }` via `defaultVenueIdForChain` semantics (already in venue-core).
3. Pass that into `useVenueTx(venue)`.
4. UI never imports `@stellar/stellar-sdk` or `@solana/web3.js` on the new path. Privy signer only (`signRawHash` stellar; solana mock passthrough as today).

### 2. Família (option A)

- Keep `/family/deposito` and `/family/saque` as PIX mock.
- Add `/family/investir` (wallet→vault deposit) and `/family/sacar-cofre` (or equivalent withdraw) using `useVenueTx` + account chain.
- Dashboard links to the new invest/withdraw-cofre routes; PIX CTAs unchanged.
- Chain unlock/select UI (dumb): show selected + unlocked; `POST /account/chain` with `{ action, chainId }`.

### 3. B2B MoveDrawer

- Switch `MoveDrawer` from `useStellarTx` to `useVenueTx` resolved from `GET /account/chain`.
- Leave `useDepositFlow` / `useWithdrawFlow` (PIX ramp) on legacy `/deposit`/`/withdraw`.
- Keep `useStellarTx` for PIX / Etherfuse / any remaining ramp-only screens.

### 4. Ledger per venue

- Add `venueId` (and optionally `chainId`) on `Deposit` (and withdraw ledger rows if they share the same table pattern).
- Default existing rows to `stellar:blend` in migration.
- `VenueService.submitDeposit` / `submitWithdraw` pass venue id into ledger.
- `spendable` / `principal` **per venue** for venue flows; do not break the old dashboard in the first cut — keep a company-level aggregate path for legacy dashboard OR scope venue spendable behind venue-aware callers first.
- Never sum Stellar 7-decimal and Solana 6-decimal amounts into one canonical USDC number.

### 5. Stellar live / Solana mock

- `STELLAR_VENUE_MODE=live` or `VENUE_MODE=live` → existing `StellarDefindexLiveAdapter` + current envs (`VAULT_ADDRESS`, `FEE_SPONSOR_SECRET_KEY`, …).
- Missing env → mock.
- Solana: mock after unlock works. No `SolanaLiveAdapter`. No `@solana/web3.js` in web. Privy solana wallet creation may remain TODO if blocked.

### 6. Style & git

- Follow `docs/Preference - Coding Style.md` (project Cursor rule).
- Agent **does not** `git commit` / push (`.cursor/rules/no-git-commits.mdc`). Human commits; no Cursor co-author trailers.

## Success criteria

- Família invest/withdraw-cofre via `stellar:blend` without UI knowing DeFindex/XDR.
- New account default Stellar.
- Unlock + select Solana → mock `solana:kamino` responds.
- Legacy `/deposit`, `/withdraw`, PIX ramp still work.
- New web path has no chain SDK imports.
- Registry + unlock gate tests green.

## Approach chosen

**Adopt overlay in-place** (not parallel Next app, not Origin copy again). Thin UI adapters + ledger tagging; leave ramp stack untouched.
