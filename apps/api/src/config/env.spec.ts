/**
 * Módulo: env
 * Criado em: 2026-06-24
 * Última atualização: 2026-11-01
 * Intuito: O ambiente sobe só com as chaves certas e o padrão de desenvolvimento.
 * Sequência: parses a valid env; rejects an invalid network; rejects missing required keys; defaults the app env to development; turns the local session on only when asked; parses an explicit app env; rejects an unknown app env; a sessão local só vale com APP_ENV development ou test; CORS libera os headers da API; sem CORS_ORIGIN e sem APP_ENV o CORS só libera o localhost.
 */
import {
  CORS_DEV_ORIGINS,
  corsOptionsFor,
  loadEnv,
  LOCAL_SESSION_NOT_ALLOWED_MESSAGE,
} from './env';

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
    expect(
      loadEnv({ ...base, APP_ENV: 'development', DEV_LOCAL_SESSION: 'true' })
        .localSession,
    ).toBe(true);
    expect(
      loadEnv({ ...base, APP_ENV: 'development', DEV_LOCAL_SESSION: 'false' })
        .localSession,
    ).toBe(false);
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

  it.each(['development', 'test'])(
    'aceita DEV_LOCAL_SESSION=true com APP_ENV=%s',
    (appEnv) => {
      const env = loadEnv({
        ...base,
        APP_ENV: appEnv,
        DEV_LOCAL_SESSION: 'true',
      });
      expect(env.localSession).toBe(true);
      expect(env.appEnv).toBe(appEnv);
    },
  );

  it.each([
    ['production', { APP_ENV: 'production' }],
    ['staging', { APP_ENV: 'staging' }],
    ['prod', { APP_ENV: 'prod' }],
    ['homolog', { APP_ENV: 'homolog' }],
    ['DEVELOPMENT', { APP_ENV: 'DEVELOPMENT' }],
    ['vazio', { APP_ENV: '' }],
    ['ausente', {}],
    ['ausente com NODE_ENV=production', { NODE_ENV: 'production' }],
  ])(
    'recusa DEV_LOCAL_SESSION=true com APP_ENV %s, sem imprimir valores',
    (_label, extra) => {
      let message = '';
      try {
        loadEnv({
          ...base,
          ...extra,
          PRIVY_APP_SECRET: 'segredo-ficticio',
          DEV_LOCAL_SESSION: 'true',
        });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toBe(LOCAL_SESSION_NOT_ALLOWED_MESSAGE);
      expect(message).not.toContain(base.DATABASE_URL);
      expect(message).not.toContain('segredo-ficticio');
    },
  );

  it('produção com a sessão local desligada sobe normalmente', () => {
    expect(
      loadEnv({ ...base, APP_ENV: 'production', DEV_LOCAL_SESSION: 'false' })
        .localSession,
    ).toBe(false);
  });

  it('CORS libera Authorization, Content-Type, privy-id-token e X-Household-Id', () => {
    const options = corsOptionsFor({ APP_ENV: 'production' });
    expect(options.allowedHeaders).toEqual([
      'Authorization',
      'Content-Type',
      'privy-id-token',
      'X-Household-Id',
    ]);
    expect(options.origin).toEqual([
      'https://yield2pay.com',
      'https://www.yield2pay.com',
    ]);
    expect(
      corsOptionsFor({ CORS_ORIGIN: 'https://a.example, https://b.example' })
        .origin,
    ).toEqual(['https://a.example', 'https://b.example']);
    expect(corsOptionsFor({ APP_ENV: 'development' }).origin).toBe(true);
  });

  it.each([
    ['nada definido', {}],
    ['NODE_ENV=production', { NODE_ENV: 'production' }],
    ['APP_ENV vazio', { APP_ENV: '' }],
    ['CORS_ORIGIN vazio', { CORS_ORIGIN: '' }],
  ])(
    'sem CORS_ORIGIN e sem APP_ENV (%s) só libera o localhost',
    (_label, raw) => {
      const { origin } = corsOptionsFor(raw);
      expect(origin).not.toBe(true);
      expect(origin).toEqual(CORS_DEV_ORIGINS);
      expect(CORS_DEV_ORIGINS).toEqual([
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ]);
    },
  );

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
      loadEnv({ ...base, FINANCIAL_PRODUCT_ENABLED: 'true' })
        .financialProductEnabled,
    ).toBe(true);
  });
});
