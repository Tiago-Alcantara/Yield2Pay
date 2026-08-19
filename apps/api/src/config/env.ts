import { z } from 'zod';
import type { AppEnv } from '@yield2pay/shared';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  DEFINDEX_API_KEY: z.string().min(1),
  DEFINDEX_BASE_URL: z.string().url(),
  VAULT_ADDRESS: z.string().min(1),
  USDC_ADDRESS: z.string().min(1),
  STELLAR_NETWORK: z.enum(['testnet', 'public']),
  SOROBAN_RPC_URL: z.string().url(),
  FEE_SPONSOR_SECRET_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  // Ambiente lógico da aplicação. Governa o quanto o erro expõe: só fora de
  // 'production' a resposta de erro carrega technicalDetails (stack, endpoint,
  // requestId). Não derivamos de NODE_ENV porque o build de homologação também
  // roda como production.
  APP_ENV: z
    .enum(['production', 'staging', 'development'])
    .default('development'),
  DEMO_YIELD_BPS: z.coerce.number().int().nonnegative().default(0),
  DEMO_RETURNS_CHANGE_PERCENT: z.string().default('3.2'),
  // Etherfuse on/off-ramp integration. Ausente = mock mode automático.
  ETHERFUSE_API_KEY: z.string().optional(),
  ETHERFUSE_BASE_URL: z
    .string()
    .url()
    .default('https://api.sand.etherfuse.com'),
  // Override do customerId/org (default: 3º segmento da API key).
  ETHERFUSE_CUSTOMER_ID: z.string().optional(),
  // Moeda fiat do ramp: BRL (Pix) ou MXN (SPEI). Default BRL.
  ETHERFUSE_FIAT_CURRENCY: z.enum(['BRL', 'MXN']).default('BRL'),
});

export type Env = {
  databaseUrl: string;
  privyAppId: string;
  privyAppSecret: string;
  defindexApiKey: string;
  defindexBaseUrl: string;
  vaultAddress: string;
  usdcAddress: string;
  stellarNetwork: 'testnet' | 'public';
  sorobanRpcUrl: string;
  feeSponsorSecretKey: string;
  port: number;
  appEnv: AppEnv;
  demoYieldBps: number;
  demoReturnsChangePercent: string;
  etherfuseApiKey: string | undefined;
  etherfuseBaseUrl: string;
  etherfuseCustomerId: string | undefined;
  etherfuseFiatCurrency: 'BRL' | 'MXN';
};

export function loadEnv(raw: Record<string, string | undefined>): Env {
  const parsed = schema.parse(raw);
  return {
    databaseUrl: parsed.DATABASE_URL,
    privyAppId: parsed.PRIVY_APP_ID,
    privyAppSecret: parsed.PRIVY_APP_SECRET,
    defindexApiKey: parsed.DEFINDEX_API_KEY,
    defindexBaseUrl: parsed.DEFINDEX_BASE_URL,
    vaultAddress: parsed.VAULT_ADDRESS,
    usdcAddress: parsed.USDC_ADDRESS,
    stellarNetwork: parsed.STELLAR_NETWORK,
    sorobanRpcUrl: parsed.SOROBAN_RPC_URL,
    feeSponsorSecretKey: parsed.FEE_SPONSOR_SECRET_KEY,
    port: parsed.PORT,
    appEnv: parsed.APP_ENV,
    demoYieldBps: parsed.DEMO_YIELD_BPS,
    demoReturnsChangePercent: parsed.DEMO_RETURNS_CHANGE_PERCENT,
    etherfuseApiKey: parsed.ETHERFUSE_API_KEY,
    etherfuseBaseUrl: parsed.ETHERFUSE_BASE_URL,
    etherfuseCustomerId: parsed.ETHERFUSE_CUSTOMER_ID,
    etherfuseFiatCurrency: parsed.ETHERFUSE_FIAT_CURRENCY,
  };
}
