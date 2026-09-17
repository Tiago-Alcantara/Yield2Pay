# Yield2Pay · estudo de arquitetura multichain

Este repositório documenta como unificar os dois Yield2Pay existentes — [Stellar](https://github.com/Tiago-Alcantara/Yield2Pay) e [Solana](https://github.com/Tiago-Alcantara/yield2Pay-solana) — num único código com adapters por chain.

Não é o app de produção. É o estudo: veredito, comparação, ports, modelo de dados e plano de extração.

## Veredito em uma frase

O produto já é o mesmo nos dois repos. Multichain é extrair o domínio (ledger, liberdade %, contas) e isolar Stellar/Solana atrás de `WalletPort`, `TxPort` e `VaultPort` — usando a vertical famílias (Solana) como trunk e a Stellar como o primeiro adapter “de verdade” (DeFindex + PIX).

Documento completo: [`docs/ARQUITETURA-MULTICHAIN.md`](docs/ARQUITETURA-MULTICHAIN.md).  
Plano de desenvolvimento (plugin por protocolo, git, o que falta você definir): [`docs/PLANO-PLUGIN-PROTOCOLO.md`](docs/PLANO-PLUGIN-PROTOCOLO.md).

## Rodar local

```bash
pnpm install
pnpm dev -- --port 43147
```

Abre `http://127.0.0.1:43147`.

## O que está neste site

- Comparação dos dois repositórios (tenant, decimais, cofre, tx, ramp)
- Arquitetura alvo em camadas
- Contratos TypeScript dos ports
- Schema unificado
- Plano em fases e o que **não** unificar
