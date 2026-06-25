import { z } from 'zod';

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
  PORT: z.coerce.number().int().positive().default(3000),
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
  port: number;
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
    port: parsed.PORT,
  };
}
