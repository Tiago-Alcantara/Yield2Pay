import { z } from 'zod';
import type { AppEnv } from '@yield2pay/shared';
import { isFinancialProductEnabled } from './financial-product';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  FINANCIAL_PRODUCT_ENABLED: z.enum(['true', 'false']).default('false'),
  PORT: z.coerce.number().int().positive().default(3000),
  // Ambiente lógico da aplicação. Governa o quanto o erro expõe: só fora de
  // 'production' a resposta de erro carrega technicalDetails (endpoint,
  // requestId), sem stack. Não derivamos de NODE_ENV porque o build de homologação também
  // roda como production.
  APP_ENV: z
    .enum(['production', 'staging', 'development'])
    .default('development'),
  // Sessão fixa do painel local, sem Privy. Fica desligada fora desta máquina.
  DEV_LOCAL_SESSION: z.enum(['true', 'false']).default('false'),
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

/** Chaves do cofre. Obrigatórias só com FINANCIAL_PRODUCT_ENABLED=true. */
const financialSchema = z.object({
  DEFINDEX_API_KEY: z.string().min(1),
  DEFINDEX_BASE_URL: z.string().url(),
  VAULT_ADDRESS: z.string().min(1),
  USDC_ADDRESS: z.string().min(1),
  STELLAR_NETWORK: z.enum(['testnet', 'public']),
  SOROBAN_RPC_URL: z.string().url(),
  FEE_SPONSOR_SECRET_KEY: z.string().min(1),
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
  localSession: boolean;
  demoYieldBps: number;
  demoReturnsChangePercent: string;
  etherfuseApiKey: string | undefined;
  etherfuseBaseUrl: string;
  etherfuseCustomerId: string | undefined;
  etherfuseFiatCurrency: 'BRL' | 'MXN';
  financialProductEnabled: boolean;
};

export function loadEnv(raw: Record<string, string | undefined>): Env {
  const parsed = schema.parse(raw);
  const financialProductEnabled = isFinancialProductEnabled({
    FINANCIAL_PRODUCT_ENABLED: parsed.FINANCIAL_PRODUCT_ENABLED,
  });
  const financial = (
    financialProductEnabled ? financialSchema : financialSchema.partial()
  ).parse(raw);
  return {
    databaseUrl: parsed.DATABASE_URL,
    privyAppId: parsed.PRIVY_APP_ID,
    privyAppSecret: parsed.PRIVY_APP_SECRET,
    defindexApiKey: financial.DEFINDEX_API_KEY ?? '',
    defindexBaseUrl: financial.DEFINDEX_BASE_URL ?? 'http://127.0.0.1',
    vaultAddress: financial.VAULT_ADDRESS ?? '',
    usdcAddress: financial.USDC_ADDRESS ?? '',
    stellarNetwork: financial.STELLAR_NETWORK ?? 'testnet',
    sorobanRpcUrl: financial.SOROBAN_RPC_URL ?? 'http://127.0.0.1',
    feeSponsorSecretKey: financial.FEE_SPONSOR_SECRET_KEY ?? '',
    port: parsed.PORT,
    appEnv: parsed.APP_ENV,
    localSession: parsed.DEV_LOCAL_SESSION === 'true',
    demoYieldBps: parsed.DEMO_YIELD_BPS,
    demoReturnsChangePercent: parsed.DEMO_RETURNS_CHANGE_PERCENT,
    etherfuseApiKey: parsed.ETHERFUSE_API_KEY,
    etherfuseBaseUrl: parsed.ETHERFUSE_BASE_URL,
    etherfuseCustomerId: parsed.ETHERFUSE_CUSTOMER_ID,
    etherfuseFiatCurrency: parsed.ETHERFUSE_FIAT_CURRENCY,
    financialProductEnabled,
  };
}
