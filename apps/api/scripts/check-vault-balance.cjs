/* Verificação on-chain: saldo do cliente no vault DeFindex (testnet). */
const fs = require('fs');
const path = require('path');
const { DefindexSDK, SupportedNetworks } = require('@defindex/sdk');

const clientAddr = process.argv[2];
if (!clientAddr || !clientAddr.startsWith('G')) {
  console.error('uso: node apps/api/scripts/check-vault-balance.cjs <Gclient>');
  process.exit(1);
}

// carrega apps/api/.env
const envPath = path.join(__dirname, '..', '.env');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*([^#\r\n]*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^\s*['"]?|['"]?\s*$/g, '').trim();
}

const VAULT = env.VAULT_ADDRESS;
if (!VAULT) {
  console.error('VAULT_ADDRESS não definido em apps/api/.env');
  process.exit(1);
}
const NET = SupportedNetworks.TESTNET;

(async () => {
  const sdk = new DefindexSDK({
    apiKey: env.DEFINDEX_API_KEY,
    baseUrl: env.DEFINDEX_BASE_URL || 'https://api.defindex.io',
  });

  console.log('vault :', VAULT);
  console.log('client:', clientAddr, '\n');

  const info = await sdk.getVaultInfo(VAULT, NET);
  console.log('totalManagedFunds:', JSON.stringify(info.totalManagedFunds));

  const bal = await sdk.getVaultBalance(VAULT, clientAddr, NET);
  console.log('\n=== posição do cliente ===');
  console.log('dfTokens         :', bal.dfTokens);
  console.log('underlyingBalance:', JSON.stringify(bal.underlyingBalance));

  if (Number(bal.dfTokens) > 0) {
    console.log('\n✅ cliente é dono de uma posição no vault');
  } else {
    console.log('\n❌ cliente sem posição (dfTokens = 0)');
  }
})().catch((e) => {
  console.error('erro:', e?.message || e);
  process.exit(1);
});
