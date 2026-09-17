import { describe, expect, it } from "vitest";
import { resolveVenueMode } from "./mode";

describe("resolveVenueMode", () => {
  it("defaults to mock when env is empty", () => {
    expect(resolveVenueMode("stellar", {})).toBe("mock");
    expect(resolveVenueMode("solana", {})).toBe("mock");
  });

  it("uses VENUE_MODE for both chains", () => {
    expect(resolveVenueMode("stellar", { VENUE_MODE: "live" })).toBe("live");
    expect(resolveVenueMode("solana", { VENUE_MODE: "live" })).toBe("live");
  });

  it("lets per-chain env override the fallback", () => {
    const env = {
      VENUE_MODE: "mock",
      STELLAR_VENUE_MODE: "live",
      SOLANA_VENUE_MODE: "mock",
    };
    expect(resolveVenueMode("stellar", env)).toBe("live");
    expect(resolveVenueMode("solana", env)).toBe("mock");
  });

  it("rejects garbage", () => {
    expect(() => resolveVenueMode("stellar", { VENUE_MODE: "prod" })).toThrow(
      /bad_venue_mode/,
    );
  });
});
