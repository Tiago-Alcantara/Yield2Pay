import type { ChainId, VenueMode } from "./types";

const KEY: Record<ChainId, string> = {
  stellar: "STELLAR_VENUE_MODE",
  solana: "SOLANA_VENUE_MODE",
};

function parseMode(raw: string | undefined, label: string): VenueMode | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "live" || v === "mock") return v;
  throw new Error(`bad_venue_mode:${label}=${raw}`);
}

/**
 * Mock vs live é só env — não existe chain `mock`.
 *
 *   VENUE_MODE=mock              fallback das duas
 *   STELLAR_VENUE_MODE=live      override Stellar
 *   SOLANA_VENUE_MODE=mock       override Solana
 *
 * Sem env: mock (demo local).
 */
export function resolveVenueMode(
  chainId: ChainId,
  env: NodeJS.Dict<string> = process.env,
): VenueMode {
  const specific = parseMode(env[KEY[chainId]], KEY[chainId]);
  if (specific) return specific;
  return parseMode(env.VENUE_MODE, "VENUE_MODE") ?? "mock";
}
