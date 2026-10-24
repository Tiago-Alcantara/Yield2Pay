/**
 * Módulo: env
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: O ambiente sobe só com as chaves certas e o padrão de desenvolvimento.
 * Sequência: parses a valid env; rejects an invalid network; rejects missing required keys; defaults the app env to development; turns the local session on only when asked; parses an explicit app env; rejects an unknown app env.
 */
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
  FEE_SPONSOR_SECRET_KEY:
    'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  PORT: '3000',
};

describe('env', () => {
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
    expect(loadEnv(base).localSession).toBe(false);
  });

  it('turns the local session on only when asked', () => {
    expect(loadEnv({ ...base, DEV_LOCAL_SESSION: 'true' }).localSession).toBe(
      true,
    );
  });

  it('parses an explicit app env', () => {
    expect(loadEnv({ ...base, APP_ENV: 'staging' }).appEnv).toBe('staging');
    expect(loadEnv({ ...base, APP_ENV: 'production' }).appEnv).toBe(
      'production',
    );
  });

  it('rejects an unknown app env', () => {
    expect(() => loadEnv({ ...base, APP_ENV: 'homolog' })).toThrow();
  });

  it('sobe sem as chaves do cofre quando o produto financeiro está desligado', () => {
    const {
      DEFINDEX_API_KEY,
      DEFINDEX_BASE_URL,
      VAULT_ADDRESS,
      USDC_ADDRESS,
      STELLAR_NETWORK,
      SOROBAN_RPC_URL,
      FEE_SPONSOR_SECRET_KEY,
      ...rest
    } = base;
    const env = loadEnv(rest);
    expect(env.financialProductEnabled).toBe(false);
    expect(env.vaultAddress).toBe('');
  });

  it('exige as chaves do cofre quando o produto financeiro está ligado', () => {
    const { VAULT_ADDRESS, ...rest } = base;
    expect(() =>
      loadEnv({ ...rest, FINANCIAL_PRODUCT_ENABLED: 'true' }),
    ).toThrow();
    expect(
      loadEnv({ ...base, FINANCIAL_PRODUCT_ENABLED: 'true' }).financialProductEnabled,
    ).toBe(true);
  });
});
