# Plano: plugin por protocolo

Como desenvolver o Yield2Pay com **plano produto** (Família / B2B) separado do **plano chain** (cada protocolo é um plugin). Este repo continua sendo o estudo; o código de produto vive nos GitHubs Stellar e Solana até você unificar.

## 1. O que estamos construindo

```
apps/web          Família + B2B, desbloqueio, liberdade %
apps/api          Conta, ledger, catálogo de venues, Auth Privy
packages/domain   Money, spendable, Account
packages/venue-core   VenuePort + UnsignedTx + registro
venues/stellar-blend
venues/solana-kamino
venues/solana-mock      (dev)
venues/polygon-…        (depois)
```

Um **venue** = `chainId` + `protocolId` (ex. `stellar:blend`, `solana:kamino`).  
O app chama `venueRegistry.get(id).deposit(owner, money)`. O plugin monta a tx nativa.

Fora deste plano, de propósito: PaymentEngine (pagar Netflix com yield), Chain Gateway (isolar sponsor key), roteador automático de APY.

---

## 2. O que você ainda precisa definir (git e produto)

Sem isso o código de plugin fica no chute.

### Git / repositório

| Decisão | Opções | Recomendação |
|---------|--------|----------------|
| **Onde mora o monorepo unificado?** | (A) Novo repo `yield2pay` (B) Continuar no Solana e absorver Stellar (C) Continuar no Stellar | **B** se quiser histórico de famílias; **A** se quiser nome limpo e importar os dois como pastas |
| **O que acontece com os dois repos atuais?** | Arquivar, virar mirror, ou só README “moved to” | README nos dois apontando para o unificado; não apagar ainda |
| **Este repo de estudo** | Fica separado ou vira `/docs` do unificado | Pode ficar separado até o unificado existir; depois copia `docs/` para lá |
| **Trunk** | `main` só? `develop`? | `main` protegida + PRs. Sem gitflow pesado |
| **Branches** | prefixo? | `feat/`, `fix/`, `venue/` (ex. `venue/stellar-blend`) |
| **Plugins no mesmo git ou repos soltos?** | monorepo pnpm vs npm privado por plugin | **Mesmo git** no começo. Repo por plugin só quando outro time publicar venue sozinho |
| **Submodules?** | sim / não | **Não**. pnpm workspaces |
| **CI** | GitHub Actions no unificado | lint + test no PR; plugin novo precisa de teste do `VenuePort` |

Você precisa **escolher A ou B** na primeira linha. O resto dá para seguir a recomendação.

### Produto (senão o plugin não sabe o que implementar)

| Decisão | Por que trava o desenvolvimento |
|---------|--------------------------------|
| **Primeiro venue de produção** | Blend Stellar? Kamino Solana? Mock só em dev? |
| **Ordem do catálogo** | O que a Família desbloqueia primeiro vs B2B |
| **Regra de desbloqueio** | O que “liberar Polygon” significa (onboarding? depósito mínimo? conteúdo?) |
| **Usuário escolhe venue ou um default?** | Tela “investir no Blend Stellar” vs um cofre só no começo |
| **Uma Account, N carteiras** | Confirmado: sim. Privy cria wallet da chain quando o venue pedir |
| **Moeda da UI** | Tudo em BRL na tela, USDC on-chain? |
| **Ramp** | PIX só Stellar (Etherfuse) no v1? Solana sem PIX? |
| **Saque** | Sempre o mesmo venue do depósito, ou misturar? (v1: mesmo venue) |
| **B2B e Família no mesmo login?** | Um `Account.kind` ou dois produtos |

Mínimo para começar a codar: **repo unificado (A ou B)** + **primeiro venue** + **v1 sem roteador e sem gateway**.

---

## 3. Contrato que os plugins têm que obedecer (congelar cedo)

Antes de portar DeFindex/Kamino, feche isto num pacote `packages/venue-core` e **não quebre** sem versionar:

```ts
type VenueId = `${string}:${string}`; // "stellar:blend"

interface VenuePlugin {
  id: VenueId;
  chainId: "stellar" | "solana" | "polygon" | string;
  protocol: string;
  privyChainType: string;
  capabilities: { ramp: boolean; mock: boolean };

  registerWallet(accountId: string, address: string): Promise<void>;
  buildDeposit(owner: string, amount: Money): Promise<UnsignedTx>;
  buildWithdraw(owner: string, amount: Money): Promise<UnsignedTx>;
  submit(signed: SignedTx): Promise<{ txRef: string }>;
  getApyPercent(): Promise<string>;
  getPositionValue(owner: string): Promise<Money>;
}
```

`UnsignedTx` / `SignedTx` **discriminados por chain** (XDR vs VersionedTransaction). O web só faz switch no signer do Privy.

Cada plugin:

- declara `decimals` e `asset` no `Money` que devolve;
- é o único lugar com SDK e `FEE_SPONSOR_*` daquela chain;
- registra-se no `VenueRegistry` (array no `app.module` ou discovery por pasta `venues/*`).

Teste de aceitação de um plugin: fake que implementa o port + o produto deposita/saca sem importar `@solana/web3.js`.

---

## 4. Fases de desenvolvimento

### Fase 0 — Git e tronco (você define + um PR de scaffold)

1. Criar (ou eleger) o repo unificado.
2. Copiar **Solana famílias** como `apps/web` + `apps/api` (produto atual).
3. Extrair `packages/domain` (ledger, liberdade %, Account).
4. Criar `packages/venue-core` vazio + `venues/solana-mock` (o mock que já existe).
5. README: “Stellar e Solana históricos; trunk aqui”.
6. Parar de mergear feature nova nos forks, só hotfix.

**Pronto quando:** `pnpm dev` sobe Família no mock, sem Kamino no `apps/api`.

### Fase 1 — O primeiro plugin real

1. Mover Kamino para `venues/solana-kamino`.
2. `VAULT_PROVIDER` vira `VENUE_ID=solana:kamino | solana:mock`.
3. Web: `useChainTx` lê venue da sessão, não `useSolanaTx` hardcoded.
4. Ledger grava `venueId` + `chainId` + `decimals`.

**Pronto quando:** mesmo app deposita mock **ou** Kamino só mudando env.

### Fase 2 — Catálogo e desbloqueio (produto)

1. Tabela `VenueUnlock(accountId, venueId, unlockedAt)`.
2. API `GET /venues` = catálogo global ∩ o que a conta liberou.
3. UI Família/B2B: lista bloqueado vs investir.
4. Regra v1 pode ser burra: “sempre liberar mock + stellar:blend em staging; produção só o que você configurar”.

**Pronto quando:** a aba não fala “Solana”; fala “Blend Stellar” / “Kamino” cinza ou ativo.

### Fase 3 — Plugin Stellar Blend

1. `venues/stellar-blend`: DeFindex + fee-bump + (opcional) Etherfuse como `RampPort` do plugin, não do app.
2. Privy: segunda embedded wallet `stellar` na mesma conta.
3. Spendable **por venue**, liberdade na UI pode somar.

**Pronto quando:** um usuário tem carteira Solana e Stellar e deposita nos dois sem fork de repo.

### Fase 4 — Polygon (ou o próximo)

1. Novo pacote `venues/polygon-…` copiando o molde.
2. Sem mudar Família, ledger ou desbloqueio — só registro + env + Privy chain.

**Pronto quando:** o PR do venue novo não toca `apps/web` além de um ícone no catálogo.

### Fase 5 — depois (não misturar agora)

- Chain Gateway (sponsor key fora do product-api).
- Roteador de APY.
- Pagar assinatura com yield.

---

## 5. Trabalho concreto por pasta (checklist)

**Produto (`apps/web`)**

- [ ] Trocar `useSolanaTx` / `useStellarTx` por `useVenueTx(venueId)`
- [ ] Tela catálogo (bloqueado / desbloqueado)
- [ ] Família e B2B no mesmo app, `Account.kind`
- [ ] Signer Privy: `stellar` vs `solana` vs EVM conforme o plugin

**Produto (`apps/api`)**

- [ ] `VenueRegistry` no módulo Nest
- [ ] Controllers `/v1/venues/:venueId/deposit/build|submit`
- [ ] Ledger com `venueId`
- [ ] Unlock service
- [ ] **Não** importar `@defindex/sdk` / `@kamino-finance` / ethers

**Plugins (`venues/*`)**

- [ ] `solana-mock` primeiro
- [ ] `solana-kamino`
- [ ] `stellar-blend` (+ ramp se v1 PIX)
- [ ] cada um: `.env` próprio (`FEE_SPONSOR_SOLANA`, `FEE_SPONSOR_STELLAR`)

**Domínio**

- [ ] `Money` obrigatório (amount, decimals, asset, chainId)
- [ ] Nunca somar venues no banco

---

## 6. Ordem na prática (você vs código)

1. **Você decide:** repo A ou B, primeiro venue, PIX no v1 ou não.
2. **Git:** unificar tronco, README nos forks antigos, `main` + PRs.
3. **Código:** venue-core + mock → kamino → unlock UI → stellar-blend.
4. **Não fazer ainda:** gateway, roteador, escrow próprio.

Quando 1 estiver escrito (mesmo num issue), a Fase 0 pode começar sem adivinhar produto.
