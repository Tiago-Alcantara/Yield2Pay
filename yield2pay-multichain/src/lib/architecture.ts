export const chains = ["stellar", "solana"] as const;
export type ChainId = (typeof chains)[number];

export const product = {
  name: "Yield2Pay",
  thesis:
    "Depositar uma vez. Só o rendimento paga as assinaturas. O principal continua 100% do usuário.",
  metric:
    "Percentual de Liberdade = rendimento mensal ÷ mensalidades, teto 100%.",
};

export const repos = {
  stellar: {
    name: "Yield2Pay (Stellar)",
    url: "https://github.com/Tiago-Alcantara/Yield2Pay",
    role: "Produto principal em testnet. B2B vivo + /family ainda desconectado da API.",
    tenant: "Company",
    decimals: 7,
    vault: "DeFindex (estratégia Blend USDC)",
    txShape: "XDR + hash + signatureHex + fee-bump",
    ramp: "Etherfuse PIX ⇄ USDC",
    privy: "chainType: stellar",
    status: "MVP testnet",
  },
  solana: {
    name: "yield2Pay-solana",
    url: "https://github.com/Tiago-Alcantara/yield2Pay-solana",
    role: "Hackathon. Vertical famílias plugada. Cofre mock em devnet; Kamino só em mainnet.",
    tenant: "Household + Member",
    decimals: 6,
    vault: "Kamino Lend ou MockVault 1:1",
    txShape: "VersionedTransaction base64, sponsor = feePayer",
    ramp: "Ausente (depósito SPL direto)",
    privy: "chainType: solana / solana:devnet",
    status: "Hackathon / devnet",
  },
} as const;

export const sameEverywhere = [
  {
    title: "Motor de produto",
    items: [
      "Depositar → aplicar em cofre DeFi → principal intocável",
      "spendable = max(0, vaultValue − principal)",
      "Assinaturas ordenadas por prioridade",
      "familyMath: monthlyYieldOf, depositForMonthly, freedomPercent, coverageRows",
    ],
  },
  {
    title: "Forma da plataforma",
    items: [
      "Monorepo pnpm: apps/web (Next 16) + apps/api (Nest 11) + packages/shared",
      "Privy (Google) + carteira embedded + JWT no AuthGuard",
      "Não-custodial: API monta tx, usuário assina, tesouraria só patrocina taxa",
      "Prisma + Postgres: Deposit (saque = linha negativa), YieldSnapshot, dashboard SpendableView",
      "Cron 2h: snapshot diário. Mesmo contrato de erro ApiErrorPayload",
    ],
  },
];

export const divergences = [
  {
    axis: "Identidade do tenant",
    stellar: "Company 1:1 Privy",
    solana: "Household + Members (titular loga; dependentes são rótulo)",
    decision: "Account unificado. Members opcionais. B2B = Account sem members.",
  },
  {
    axis: "Carteira",
    stellar: "stellarAddress; conta criada/fundida com ~2 XLM pelo sponsor",
    solana: "solanaAddress + ATA USDC criada pelo sponsor",
    decision: "Wallet(chainId, address, extras Json). N carteiras por Account.",
  },
  {
    axis: "Unidade monetária",
    stellar: "BigInt 7 casas (Stellar USDC)",
    solana: "BigInt 6 casas (SPL USDC / Real mock)",
    decision: "Money { amount, decimals, asset, chainId }. Nunca somar chains cruas.",
  },
  {
    axis: "Transação patrocinada",
    stellar: "hashForSigning + fee-bump XDR",
    solana: "Sponsor feePayer, tx parcial, cliente assina o resto",
    decision: "UnsignedTx discriminado por chain. UI não conhece XDR vs base64.",
  },
  {
    axis: "Cofre",
    stellar: "VaultService concreto no DeFindex SDK (XDR pronto)",
    solana: "VaultService abstrato → KaminoVaultService | MockVaultService (instruções)",
    decision: "Port VaultPort. Solana já está no formato certo; Stellar vira adapter.",
  },
  {
    axis: "Ramp fiat",
    stellar: "Etherfuse (claim/burn XDR, KYC, orders)",
    solana: "Não existe",
    decision: "RampPort opcional. Chain sem ramp = depósito on-chain direto.",
  },
  {
    axis: "Pagamento de assinatura",
    stellar: "Bills são CRUD. Yield → vendor não existe.",
    solana: "Subs são CRUD + prioridade. Mesmo buraco.",
    decision: "PaymentEngine no domínio, depois. Não entra no primeiro corte multichain.",
  },
];

export const layers = [
  {
    id: "ui",
    name: "apps/web",
    color: "ui",
    body: "Telas, liberdade %, depósito, saque, config. Falam com ChainSession, nunca com Stellar SDK ou web3.js.",
  },
  {
    id: "api",
    name: "apps/api",
    color: "api",
    body: "Casos de uso: registrar carteira, depositar, sacar, dashboard, bills. Recebe chainId e despacha ao adapter.",
  },
  {
    id: "domain",
    name: "packages/domain",
    color: "domain",
    body: "Account, Money, Ledger, Freedom, Subscription coverage. Zero import de chain SDK.",
  },
  {
    id: "ports",
    name: "packages/chain-core",
    color: "ports",
    body: "Interfaces: WalletPort, TxPort, VaultPort, RampPort?, Oracle/APY. Contratos estáveis.",
  },
  {
    id: "adapters",
    name: "packages/chain-stellar · chain-solana",
    color: "adapters",
    body: "SDKs, RPC, sponsor, vault vendor. Podem divergir 100%. Registrados num ChainRegistry.",
  },
];

export const phases = [
  {
    n: "0",
    title: "Congelar o produto, não a chain",
    detail:
      "A vertical famílias lidera. O repo Solana tem o modelo de dados certo (Household, Sub, prioridade). O repo Stellar tem ramp PIX e cofre real em testnet. O monorepo-alvo nasce do Solana (famílias) e reabsorve Stellar como adapter — não o contrário.",
  },
  {
    n: "1",
    title: "Extrair o núcleo",
    detail:
      "Mover familyMath, LedgerService.computeSpendable, SpendableView, ApiErrorPayload e o AuthGuard (Privy → Account) para packages/domain e packages/shared. Cortar stellarAddress / solanaAddress dos DTOs públicos. Introduzir chainId + address.",
  },
  {
    n: "2",
    title: "Definir ports e encapsular Solana",
    detail:
      "O VaultService abstrato da Solana vira VaultPort. SolanaService vira TxPort + WalletPort. MockVault e Kamino continuam implementações internas do adapter Solana. A API só depende das interfaces.",
  },
  {
    n: "3",
    title: "Adapter Stellar",
    detail:
      "Reescrever StellarService + VaultService (DeFindex) + fluxo Etherfuse como packages/chain-stellar. Mapear XDR para UnsignedTx. Manter 7 decimais só dentro do adapter; o domínio vê Money.",
  },
  {
    n: "4",
    title: "Frontend ChainSession",
    detail:
      "Um hook useChainTx no lugar de useStellarTx e useSolanaTx. Privy cria a carteira do chainType ativo. Seletor de rede no header. /family permanece o produto; B2B reusa o mesmo motor.",
  },
  {
    n: "5",
    title: "Ramp e pagamento (depois)",
    detail:
      "RampPort na Stellar primeiro. Na Solana, um ramp quando existir (Etherfuse Solana, ou outro). PaymentEngine — claim só de yield, payout ao vendor — é um produto novo, não um requisito para unificar as duas chains.",
  },
];

export const doNotUnify = [
  "Um único formato de transação (XDR ≠ VersionedTransaction).",
  "Um único sponsor (fee-bump Stellar ≠ feePayer Solana).",
  "Um único vault vendor (DeFindex ≠ Kamino). O produto vende yield, não o protocolo.",
  "Somar principal Stellar (7d) com principal Solana (6d) no banco sem Money.",
  "Um contrato/programa Yield2Pay próprio agora. Nenhum dos dois repos tem escrow custom. Multichain não precisa disso para o primeiro corte.",
  "Uma posição única cross-chain. Custódia é por carteira. Liberdade total é agregação de UI, não um ledger misturado.",
];

export const schemaTarget = [
  {
    model: "Account",
    fields: "id, privyUserId, kind: family | company, displayName",
  },
  {
    model: "Member",
    fields: "accountId, name, isOwner — só kind=family",
  },
  {
    model: "Wallet",
    fields: "accountId, chainId, address UNIQUE(chainId,address), extras Json (ATA, trustline…)",
  },
  {
    model: "Position",
    fields: "accountId, chainId, vaultProvider, shares, underlyingValue, syncedAt",
  },
  {
    model: "LedgerEntry",
    fields: "accountId, chainId, amount (bigint), decimals, asset, txRef UNIQUE, kind: deposit|withdraw, rampOrderId?",
  },
  {
    model: "Subscription",
    fields: "accountId, name, monthlyCost + decimals + asset, category, priority, memberId?",
  },
  {
    model: "YieldSnapshot",
    fields: "accountId, chainId, vaultValue, principal, spendable, createdAt",
  },
  {
    model: "RampCustomer / RampOrder",
    fields: "opcionais, chainId=stellar no início",
  },
];

export const portsCode = `export type ChainId = "stellar" | "solana";

export type Money = {
  amount: bigint;      // unidades menores daquele asset naquela chain
  decimals: number;    // 7 na Stellar USDC, 6 na Solana USDC
  asset: "USDC" | "BRL_MOCK";
  chainId: ChainId;
};

export type UnsignedTx =
  | { chain: "stellar"; xdr: string; hash: string }
  | { chain: "solana"; transactionBase64: string };

export type SignedTx =
  | { chain: "stellar"; xdr: string; signatureHex: string }
  | { chain: "solana"; signedTransactionBase64: string };

export interface WalletPort {
  chainId: ChainId;
  validateAddress(address: string): boolean;
  register(accountId: string, address: string): Promise<void>;
  getSpendableBalance(address: string): Promise<Money>;
}

export interface TxPort {
  chainId: ChainId;
  buildSponsored(params: {
    owner: string;
    instructions: unknown; // opaco: o VaultPort do mesmo adapter produz
  }): Promise<UnsignedTx>;
  submit(signed: SignedTx): Promise<{ txRef: string }>;
}

export interface VaultPort {
  chainId: ChainId;
  provider: string; // "defindex" | "kamino" | "mock"
  buildDeposit(owner: string, amount: Money): Promise<unknown>;
  buildWithdraw(owner: string, amount: Money): Promise<unknown>;
  getApyPercent(): Promise<string>;
  getPositionValue(owner: string): Promise<Money>;
}

export interface RampPort {
  chainId: ChainId;
  startOnramp(fiatAmount: string): Promise<{ orderId: string; instructions: unknown }>;
  startOfframp(amount: Money): Promise<{ orderId: string; instructions: unknown }>;
}

export interface ChainAdapter {
  chainId: ChainId;
  wallet: WalletPort;
  tx: TxPort;
  vault: VaultPort;
  ramp?: RampPort;
  privyChainType: "stellar" | "solana";
}`;

export const frontendCode = `// apps/web — um único fluxo
const { chainId } = useChainSession(); // "stellar" | "solana"
const { deposit, withdraw } = useChainTx();

await deposit(parseAmount(input, meta.decimals));
// internamente:
//   POST /v1/:chainId/deposit/build
//   privy.sign(unsignedTx)  // stellar: signRawHash; solana: signTransaction
//   POST /v1/:chainId/deposit/submit`;

export const gaps = [
  {
    title: "O yield ainda não paga ninguém",
    body: "Nos dois repos, bills/subs são catálogo. Sem claim_yield, sem payout, sem split 95/5. Multichain não resolve isso. O PaymentEngine é o próximo produto, com um PayoutPort por chain (e, no Brasil, um trecho fiat).",
  },
  {
    title: "Dois produtos, um motor",
    body: "Stellar ainda carrega dashboard B2B (Company, Etherfuse). Solana só famílias. Unificar Account.kind evita fork eterno, mas a UI B2B pode continuar um route group.",
  },
  {
    title: "Kamino não roda em devnet",
    body: "O adapter Solana precisa manter MockVault para desenvolvimento. Isso é saudável: o port permite N vault providers por chain.",
  },
  {
    title: "Ledger vs chain",
    body: "Na Solana, computeSpendable chegou a usar a posição on-chain como principal porque o DB falhava. A regra de ouro: chain = valor do cofre; DB = histórico de aportes do usuário. Principal nunca deve ser inferido só do vault (isso some o yield).",
  },
];
