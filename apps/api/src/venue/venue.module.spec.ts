import type { StellarLiveAdapter } from '@yield2pay/venue-core';
import { VenueRegistry, resolveVenueMode } from '@yield2pay/venue-core';
import { createStellarBlendPlugin } from '@yield2pay/venue-stellar-blend';
import { createSolanaKaminoPlugin } from '@yield2pay/venue-solana-kamino';
import { loadEnv, venueModeEnv } from '../config/env';

const baseEnvRaw = {
  DATABASE_URL: 'postgres://x',
  PRIVY_APP_ID: 'a',
  PRIVY_APP_SECRET: 's',
  DEFINDEX_API_KEY: 'sk',
  DEFINDEX_BASE_URL: 'https://api.defindex.io',
  VAULT_ADDRESS: 'C...',
  USDC_ADDRESS: 'C...usdc',
  STELLAR_NETWORK: 'testnet',
  SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
  FEE_SPONSOR_SECRET_KEY:
    'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  PORT: '3000',
};

/** Mirrors VenueModule VENUE_REGISTRY factory (boot wiring smoke). */
function buildRegistry(
  venueEnv: Record<string, string>,
  stellarLive?: StellarLiveAdapter,
): VenueRegistry {
  const config = loadEnv({ ...baseEnvRaw, ...venueEnv });
  const env = venueModeEnv(config);
  const registry = new VenueRegistry();
  const stellarMode = resolveVenueMode('stellar', env);
  const solanaMode = resolveVenueMode('solana', {
    ...env,
    VENUE_MODE: env.SOLANA_VENUE_MODE ?? 'mock',
  });
  registry.register(
    createStellarBlendPlugin({
      env,
      live: stellarMode === 'live' ? stellarLive : undefined,
    }),
  );
  registry.register(createSolanaKaminoPlugin({ env, mode: solanaMode }));
  return registry;
}

describe('VenueModule registry wiring', () => {
  it('defaults stellar plugin to mock without venue env', () => {
    const registry = buildRegistry({});
    expect(registry.get('stellar:blend').mode).toBe('mock');
  });

  it('wires live adapter when STELLAR_VENUE_MODE=live', async () => {
    const liveAdapter: StellarLiveAdapter = {
      buildDeposit: vi
        .fn()
        .mockResolvedValue({ xdr: 'live-xdr', hash: 'live-hash' }),
      buildWithdraw: vi.fn(),
      submit: vi.fn(),
      getApyPercent: vi.fn(),
      getPositionValue: vi.fn(),
    };
    const registry = buildRegistry(
      { STELLAR_VENUE_MODE: 'live' },
      liveAdapter,
    );
    const plugin = registry.get('stellar:blend');
    expect(plugin.mode).toBe('live');
    const unsigned = await plugin.buildDeposit('GADDR', {
      amount: 10_000_000n,
      decimals: 7,
      asset: 'USDC',
      chainId: 'stellar',
    });
    expect(unsigned).toMatchObject({ xdr: 'live-xdr', hash: 'live-hash' });
    expect(liveAdapter.buildDeposit).toHaveBeenCalledWith('GADDR', 10_000_000n);
  });

  it('wires live adapter when VENUE_MODE=live', async () => {
    const liveAdapter: StellarLiveAdapter = {
      buildDeposit: vi
        .fn()
        .mockResolvedValue({ xdr: 'global-live-xdr', hash: 'global-live-hash' }),
      buildWithdraw: vi.fn(),
      submit: vi.fn(),
      getApyPercent: vi.fn(),
      getPositionValue: vi.fn(),
    };
    const registry = buildRegistry({ VENUE_MODE: 'live' }, liveAdapter);
    expect(registry.get('stellar:blend').mode).toBe('live');
    const unsigned = await registry.get('stellar:blend').buildDeposit('GADDR', {
      amount: 1_000_000n,
      decimals: 7,
      asset: 'USDC',
      chainId: 'stellar',
    });
    expect(unsigned).toMatchObject({
      xdr: 'global-live-xdr',
      hash: 'global-live-hash',
    });
    expect(registry.get('solana:kamino').mode).toBe('mock');
  });

  it('only enables live Solana with SOLANA_VENUE_MODE=live', () => {
    const registry = buildRegistry({
      VENUE_MODE: 'live',
      SOLANA_VENUE_MODE: 'live',
    });
    expect(registry.get('solana:kamino').mode).toBe('live');
  });
});
