import {
  InMemoryVault,
  applyMockOp,
  decodeMockOp,
  encodeMockOp,
  resolveVenueMode,
  type Money,
  type SignedTx,
  type SolanaLiveAdapter,
  type UnsignedTx,
  type VenueMode,
  type VenuePlugin,
} from "@yield2pay/venue-core";

function assertMoney(amount: Money): void {
  if (amount.chainId !== "solana") throw new Error("money_chain_mismatch");
  if (amount.decimals !== 6) throw new Error("money_decimals_mismatch");
  if (amount.amount <= 0n) throw new Error("money_non_positive");
}

function toB64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

function fromB64(text: string): string {
  return Buffer.from(text, "base64").toString("utf8");
}

export type SolanaKaminoOptions = {
  mode?: VenueMode;
  env?: NodeJS.Dict<string>;
  apyPercent?: string;
  live?: SolanaLiveAdapter;
};

/**
 * Chain Solana. `mode` vem da env: SOLANA_VENUE_MODE ou VENUE_MODE.
 * live: Kamino. mock: mesma forma de tx (base64), vault em memória.
 */
export function createSolanaKaminoPlugin(
  options: SolanaKaminoOptions = {},
): VenuePlugin {
  const mode =
    options.mode ?? resolveVenueMode("solana", options.env ?? process.env);
  const vault = new InMemoryVault();
  const apy = options.apyPercent ?? "8";

  return {
    id: "solana:kamino",
    chainId: "solana",
    protocol: "kamino",
    privyChainType: "solana",
    mode,
    capabilities: { ramp: false, mock: mode === "mock" },

    async registerWallet() {},

    async buildDeposit(owner: string, amount: Money): Promise<UnsignedTx> {
      assertMoney(amount);
      if (!owner) throw new Error("owner_required");
      const payload = encodeMockOp({
        op: "deposit",
        owner,
        amount: amount.amount.toString(),
      });
      if (mode === "mock") {
        return { chain: "solana", transactionBase64: toB64(payload) };
      }
      if (!options.live) throw new Error("live_adapter_missing:solana");
      return {
        chain: "solana",
        ...(await options.live.buildDeposit(owner, amount.amount)),
      };
    },

    async buildWithdraw(owner: string, amount: Money): Promise<UnsignedTx> {
      assertMoney(amount);
      if (!owner) throw new Error("owner_required");
      if (mode === "mock") {
        const payload = encodeMockOp({
          op: "withdraw",
          owner,
          amount: amount.amount.toString(),
        });
        return { chain: "solana", transactionBase64: toB64(payload) };
      }
      if (!options.live) throw new Error("live_adapter_missing:solana");
      return {
        chain: "solana",
        ...(await options.live.buildWithdraw(owner, amount.amount)),
      };
    },

    async submit(signed: SignedTx) {
      if (signed.chain !== "solana") throw new Error("signed_chain_mismatch");
      if (mode === "mock") {
        applyMockOp(vault, decodeMockOp(fromB64(signed.signedTransactionBase64)));
        return { txRef: vault.nextTxRef("solana-mock") };
      }
      if (!options.live) throw new Error("live_adapter_missing:solana");
      return options.live.submit(signed.signedTransactionBase64);
    },

    async getApyPercent() {
      if (mode === "live" && options.live) return options.live.getApyPercent();
      return mode === "mock" ? apy : "0";
    },

    async getPositionValue(owner: string): Promise<Money> {
      if (!owner) throw new Error("owner_required");
      if (mode === "live") {
        if (!options.live) throw new Error("live_adapter_missing:solana");
        const amount = await options.live.getPositionValue(owner);
        return { amount, decimals: 6, asset: "USDC", chainId: "solana" };
      }
      return {
        amount: vault.balance(owner),
        decimals: 6,
        asset: "USDC",
        chainId: "solana",
      };
    },
  };
}
