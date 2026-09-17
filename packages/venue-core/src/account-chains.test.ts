import { describe, expect, it } from "vitest";
import {
  VenueRegistry,
  assertCanUseChain,
  defaultAccountChains,
  selectChain,
  unlockChain,
} from "./index";
import type { Money, UnsignedTx, VenuePlugin } from "./types";

function stub(id: VenuePlugin["id"], chainId: VenuePlugin["chainId"]): VenuePlugin {
  const money = (amount: bigint): Money => ({
    amount,
    decimals: 7,
    asset: "USDC",
    chainId,
  });
  return {
    id,
    chainId,
    protocol: "stub",
    privyChainType: chainId,
    mode: "mock",
    capabilities: { ramp: false, mock: true },
    async registerWallet() {},
    async buildDeposit(): Promise<UnsignedTx> {
      return { chain: "stellar", xdr: "d", hash: "h" };
    },
    async buildWithdraw(): Promise<UnsignedTx> {
      return { chain: "stellar", xdr: "w", hash: "h" };
    },
    async submit() {
      return { txRef: "t" };
    },
    async getApyPercent() {
      return "0";
    },
    async getPositionValue() {
      return money(0n);
    },
  };
}

describe("VenueRegistry", () => {
  it("registers and returns a plugin", () => {
    const reg = new VenueRegistry();
    const plugin = stub("stellar:blend", "stellar");
    reg.register(plugin);
    expect(reg.get("stellar:blend")).toBe(plugin);
  });

  it("rejects duplicate ids", () => {
    const reg = new VenueRegistry();
    reg.register(stub("stellar:blend", "stellar"));
    expect(() => reg.register(stub("stellar:blend", "stellar"))).toThrow(
      /venue_duplicate/,
    );
  });

  it("throws on unknown venue", () => {
    const reg = new VenueRegistry();
    expect(() => reg.get("solana:kamino")).toThrow(/venue_unknown/);
  });
});

describe("account chains", () => {
  it("defaults to stellar selected and unlocked", () => {
    const acc = defaultAccountChains();
    expect(acc.selectedChain).toBe("stellar");
    expect(acc.unlockedChains).toEqual(["stellar"]);
    expect(() => assertCanUseChain(acc, "stellar")).not.toThrow();
  });

  it("blocks a chain that is not unlocked", () => {
    const acc = defaultAccountChains();
    expect(() => assertCanUseChain(acc, "solana")).toThrow(/chain_locked/);
  });

  it("blocks a chain unlocked but not selected", () => {
    const acc = unlockChain(defaultAccountChains(), "solana");
    expect(() => assertCanUseChain(acc, "solana")).toThrow(/chain_not_selected/);
  });

  it("allows after unlock + select", () => {
    let acc = unlockChain(defaultAccountChains(), "solana");
    acc = selectChain(acc, "solana");
    expect(() => assertCanUseChain(acc, "solana")).not.toThrow();
  });

  it("cannot select a locked chain", () => {
    expect(() => selectChain(defaultAccountChains(), "solana")).toThrow(
      /chain_locked/,
    );
  });
});
