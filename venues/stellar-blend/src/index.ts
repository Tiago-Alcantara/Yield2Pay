import {
  InMemoryVault,
  applyMockOp,
  decodeMockOp,
  encodeMockOp,
  resolveVenueMode,
  type Money,
  type SignedTx,
  type StellarLiveAdapter,
  type UnsignedTx,
  type VenueMode,
  type VenuePlugin,
} from "@yield2pay/venue-core";

function assertMoney(amount: Money): void {
  if (amount.chainId !== "stellar") throw new Error("money_chain_mismatch");
  if (amount.decimals !== 7) throw new Error("money_decimals_mismatch");
  if (amount.amount <= 0n) throw new Error("money_non_positive");
}

export type StellarBlendOptions = {
  mode?: VenueMode;
  env?: NodeJS.Dict<string>;
  apyPercent?: string;
  live?: StellarLiveAdapter;
};

/**
 * Venue padrão (chain Stellar). `mode` vem da env:
 * STELLAR_VENUE_MODE ou VENUE_MODE (mock | live).
 * live: DeFindex + fee-bump no Yield2Pay. mock: vault em memória, mesmo envelope XDR.
 */
export function createStellarBlendPlugin(
  options: StellarBlendOptions = {},
): VenuePlugin {
  const mode =
    options.mode ?? resolveVenueMode("stellar", options.env ?? process.env);
  const vault = new InMemoryVault();
  const apy = options.apyPercent ?? "8";

  return {
    id: "stellar:blend",
    chainId: "stellar",
    protocol: "blend",
    privyChainType: "stellar",
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
        return { chain: "stellar", xdr: payload, hash: "mock-stellar-deposit" };
      }
      if (!options.live) throw new Error("live_adapter_missing:stellar");
      return { chain: "stellar", ...(await options.live.buildDeposit(owner, amount.amount)) };
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
        return { chain: "stellar", xdr: payload, hash: "mock-stellar-withdraw" };
      }
      if (!options.live) throw new Error("live_adapter_missing:stellar");
      return { chain: "stellar", ...(await options.live.buildWithdraw(owner, amount.amount)) };
    },

    async submit(signed: SignedTx) {
      if (signed.chain !== "stellar") throw new Error("signed_chain_mismatch");
      if (mode === "mock") {
        applyMockOp(vault, decodeMockOp(signed.xdr));
        return { txRef: vault.nextTxRef("stellar-mock") };
      }
      if (!options.live) throw new Error("live_adapter_missing:stellar");
      return options.live.submit(signed.xdr, signed.address, signed.signatureHex);
    },

    async getApyPercent() {
      if (mode === "live" && options.live) return options.live.getApyPercent();
      return mode === "mock" ? apy : "0";
    },

    async getPositionValue(owner: string): Promise<Money> {
      if (!owner) throw new Error("owner_required");
      if (mode === "live") {
        if (!options.live) throw new Error("live_adapter_missing:stellar");
        const amount = await options.live.getPositionValue(owner);
        return { amount, decimals: 7, asset: "USDC", chainId: "stellar" };
      }
      return {
        amount: vault.balance(owner),
        decimals: 7,
        asset: "USDC",
        chainId: "stellar",
      };
    },
  };
}
