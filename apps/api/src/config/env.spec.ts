import { loadEnv } from './env';

const base = {
  DATABASE_URL: 'postgres://x',
  PRIVY_APP_ID: 'a',
  PRIVY_APP_SECRET: 's',
  DEFINDEX_API_KEY: 'sk',
  DEFINDEX_BASE_URL: 'https://api.defindex.io',
  VAULT_ADDRESS: 'C...',
  USDC_ADDRESS: 'C...usdc',
  STELLAR_NETWORK: 'testnet',
  SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
  FEE_SPONSOR_SECRET_KEY: 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  PORT: '3000',
};

it('parses a valid env', () => {
  const env = loadEnv(base);
  expect(env.stellarNetwork).toBe('testnet');
  expect(env.port).toBe(3000);
});

it('rejects an invalid network', () => {
  expect(() => loadEnv({ ...base, STELLAR_NETWORK: 'mainnet' })).toThrow();
});

it('rejects missing required keys', () => {
  const { PRIVY_APP_SECRET, ...rest } = base;
  expect(() => loadEnv(rest)).toThrow();
});

it('defaults the app env to development', () => {
  expect(loadEnv(base).appEnv).toBe('development');
});

it('parses an explicit app env', () => {
  expect(loadEnv({ ...base, APP_ENV: 'staging' }).appEnv).toBe('staging');
  expect(loadEnv({ ...base, APP_ENV: 'production' }).appEnv).toBe('production');
});

it('rejects an unknown app env', () => {
  expect(() => loadEnv({ ...base, APP_ENV: 'homolog' })).toThrow();
});

it('defaults venue mode fields to undefined (plugins then mock)', () => {
  const env = loadEnv(base);
  expect(env.venueMode).toBeUndefined();
  expect(env.stellarVenueMode).toBeUndefined();
});

it('parses venue mode overrides', () => {
  const env = loadEnv({
    ...base,
    VENUE_MODE: 'mock',
    STELLAR_VENUE_MODE: 'live',
    SOLANA_VENUE_MODE: 'mock',
  });
  expect(env.venueMode).toBe('mock');
  expect(env.stellarVenueMode).toBe('live');
  expect(env.solanaVenueMode).toBe('mock');
});
