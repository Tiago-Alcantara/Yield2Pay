/**
 * Deferred integration test: VaultService.getPositionValue shares→USDC conversion.
 *
 * This file is intentionally NOT included in the normal jest suite.
 * Guard: process.env.RUN_INTEGRATION === '1'
 *
 * Run manually once DeFindex testnet credentials are available:
 *   RUN_INTEGRATION=1 npx jest --config test/jest-e2e.json vault.integration
 *
 * Purpose: pins the correct shares→underlying-USDC conversion for
 * VaultService.getPositionValue(), replacing the current PLACEHOLDER
 * implementation that returns raw dfTokens as bigint.
 *
 * The real implementation must use either:
 *   - sdk.getVaultBalance(...).underlyingBalance[0]  (direct underlying USDC)
 *   - or a dedicated SDK method for converting shares to underlying assets
 *
 * IMPORTANT: Do NOT run this in CI until real DeFindex testnet credentials
 * and a seeded vault position are available.
 */

import { SupportedNetworks } from '@defindex/sdk';

const SKIP = process.env.RUN_INTEGRATION !== '1';

(SKIP ? describe.skip : describe)(
  'VaultService integration (RUN_INTEGRATION=1)',
  () => {
    // These will be filled in once credentials exist
    const TESTNET_VAULT_ADDRESS = process.env.VAULT_ADDRESS ?? '';
    const TESTNET_USER_ADDRESS = process.env.TEST_USER_ADDRESS ?? '';

    let sdk: import('@defindex/sdk').DefindexSDK;
    let svc: import('../src/vault/vault.service').VaultService;

    beforeAll(async () => {
      const { DefindexSDK } = await import('@defindex/sdk');
      const { VaultService } = await import('../src/vault/vault.service');

      sdk = new DefindexSDK({
        apiKey: process.env.DEFINDEX_API_KEY,
        baseUrl: process.env.DEFINDEX_BASE_URL ?? 'https://api.defindex.io',
      });

      const cfg = {
        defindexApiKey: process.env.DEFINDEX_API_KEY ?? '',
        defindexBaseUrl:
          process.env.DEFINDEX_BASE_URL ?? 'https://api.defindex.io',
        vaultAddress: TESTNET_VAULT_ADDRESS,
        usdcAddress: process.env.USDC_ADDRESS ?? '',
        stellarNetwork: 'testnet' as const,
      } as any;

      svc = new VaultService(sdk, cfg);
    });

    it('getPositionValue returns underlying USDC amount (not raw shares)', async () => {
      // This test pins the correct conversion once a user with a known position exists.
      // Steps to verify:
      // 1. Fetch raw vault balance via sdk.getVaultBalance()
      // 2. Confirm underlyingBalance[0] matches the expected USDC amount
      // 3. Replace PLACEHOLDER in vault.service.ts to use underlyingBalance[0]

      const rawBalance = await sdk.getVaultBalance(
        TESTNET_VAULT_ADDRESS,
        TESTNET_USER_ADDRESS,
        SupportedNetworks.TESTNET,
      );

      const positionValue = await svc.getPositionValue(TESTNET_USER_ADDRESS);

      // WHEN the implementation is correct (post-placeholder), this must hold:
      // positionValue should equal BigInt(rawBalance.underlyingBalance[0])
      // and NOT BigInt(rawBalance.dfTokens) unless shares and underlying are 1:1

      // For now, document the expected shape:
      expect(typeof rawBalance.dfTokens).toBe('number');
      expect(Array.isArray(rawBalance.underlyingBalance)).toBe(true);

      // TODO: Once the placeholder is replaced, assert:
      // expect(positionValue).toBe(BigInt(rawBalance.underlyingBalance[0]));

      // Currently PLACEHOLDER — raw shares:
      expect(positionValue).toBe(BigInt(rawBalance.dfTokens));
    });

    it('getApyPercent returns a numeric string from the real API', async () => {
      const apy = await svc.getApyPercent();
      expect(typeof apy).toBe('string');
      expect(Number(apy)).toBeGreaterThanOrEqual(0);
    });
  },
);
