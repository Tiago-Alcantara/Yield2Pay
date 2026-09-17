import type { ChainId, VenueId } from "./types";

export function defaultVenueIdForChain(chainId: ChainId): VenueId {
  return chainId === "stellar" ? "stellar:blend" : "solana:kamino";
}
