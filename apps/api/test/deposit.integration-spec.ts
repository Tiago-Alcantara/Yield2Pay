/**
 * Deferred integration test: full deposit flow (build → sign → submit → assert position).
 *
 * This file is intentionally NOT included in the hermetic unit suite
 * (vitest.config.ts → src/**' + '/*.spec.ts). It runs under the e2e config
 * (vitest.config.e2e.ts) and is additionally guarded by RUN_INTEGRATION === '1'.
 *
 * Run manually once testnet credentials and a funded keypair are available:
 *   RUN_INTEGRATION=1 pnpm --filter @yield2pay/api test:e2e
 *
 * Purpose: pins the full-flow deposit path:
 *   1. build  — DepositService.build() calls WalletService.getAddress → VaultService.buildDeposit → StellarService.hashForSigning
 *   2. sign   — hash bytes are signed locally with a funded Stellar Keypair (stand-in for Privy wallet)
 *   3. submit — DepositService.submit() calls StellarService.attachAndSubmit → LedgerService.recordDeposit
 *   4. assert — VaultService.getPositionValue reflects the new deposit
 *
 * Required environment variables:
 *   DEFINDEX_API_KEY       — DeFindex API key
 *   DEFINDEX_BASE_URL      — DeFindex base URL (default: https://api.defindex.io)
 *   VAULT_ADDRESS          — testnet vault contract address
 *   USDC_ADDRESS           — testnet USDC asset address
 *   TEST_SECRET_KEY        — secret key of a funded testnet Stellar account
 *   TEST_COMPANY_ID        — company ID whose wallet maps to the funded account
 *
 * IMPORTANT: Do NOT run in CI until credentials are available.
 */

import { Keypair } from '@stellar/stellar-sdk';

const SKIP = process.env.RUN_INTEGRATION !== '1';

(SKIP ? describe.skip : describe)(
  'Deposit integration (RUN_INTEGRATION=1)',
  () => {
    const DEPOSIT_AMOUNT = 1_000_000n; // 1 USDC in stroops
    const COMPANY_ID = process.env.TEST_COMPANY_ID ?? 'test-company';
    const SECRET_KEY = process.env.TEST_SECRET_KEY ?? '';

    let depositSvc: import('../src/deposit/deposit.service').DepositService;
    let vaultSvc: import('../src/vault/vault.service').VaultService;

    beforeAll(async () => {
      const { DefindexSDK } = await import('@defindex/sdk');
      const { VaultService } = await import('../src/vault/vault.service');
      const { StellarService } = await import('../src/stellar/stellar.service');
      const { DepositService } = await import('../src/deposit/deposit.service');

      const cfg = {
        defindexApiKey: process.env.DEFINDEX_API_KEY ?? '',
        defindexBaseUrl:
          process.env.DEFINDEX_BASE_URL ?? 'https://api.defindex.io',
        vaultAddress: process.env.VAULT_ADDRESS ?? '',
        usdcAddress: process.env.USDC_ADDRESS ?? '',
        stellarNetwork: 'testnet' as const,
      } as any;

      const sdk = new DefindexSDK({
        apiKey: cfg.defindexApiKey,
        baseUrl: cfg.defindexBaseUrl,
      });

      vaultSvc = new VaultService(sdk, cfg);
      const stellarSvc = new StellarService(cfg);

      // walletSvc stub: resolves TEST_COMPANY_ID to the funded keypair's public key
      const keypair = Keypair.fromSecret(SECRET_KEY);
      const walletSvcStub = {
        getAddress: async (companyId: string) => {
          if (companyId === COMPANY_ID) return keypair.publicKey();
          throw new Error(`No address for company ${companyId}`);
        },
      };

      // ledgerSvc stub: records deposit in memory (no DB required for integration test)
      const recorded: Array<{
        companyId: string;
        amount: bigint;
        txHash: string;
      }> = [];
      const ledgerSvcStub = {
        recordDeposit: async (
          companyId: string,
          amount: bigint,
          txHash: string,
        ) => {
          recorded.push({ companyId, amount, txHash });
        },
        _recorded: recorded,
      };

      depositSvc = new DepositService(
        vaultSvc as any,
        stellarSvc as any,
        ledgerSvcStub as any,
        walletSvcStub as any,
      );
    });

    it('full deposit flow: build → sign locally → submit → position reflects deposit', async () => {
      const keypair = Keypair.fromSecret(SECRET_KEY);

      // Step 1: build — get XDR and hash
      const { xdr, hash } = await depositSvc.build(COMPANY_ID, DEPOSIT_AMOUNT);
      expect(typeof xdr).toBe('string');
      expect(typeof hash).toBe('string');

      // Step 2: sign the hash locally with the funded keypair
      const hashBytes = Buffer.from(
        hash.startsWith('0x') ? hash.slice(2) : hash,
        'hex',
      );
      const sigBytes = keypair.sign(hashBytes);
      const signatureHex = '0x' + sigBytes.toString('hex');

      // Record position before deposit for delta assertion
      const stellarAddress = keypair.publicKey();
      const positionBefore = await vaultSvc.getPositionValue(stellarAddress);

      // Step 3: submit — attach signature and broadcast
      const { txHash } = await depositSvc.submit(COMPANY_ID, {
        xdr,
        signatureHex,
        stellarAddress,
        amount: DEPOSIT_AMOUNT.toString(),
      });
      expect(typeof txHash).toBe('string');
      expect(txHash.length).toBeGreaterThan(0);

      // Step 4: assert — vault position has increased
      // Allow a few seconds for ledger propagation
      await new Promise((r) => setTimeout(r, 5000));
      const positionAfter = await vaultSvc.getPositionValue(stellarAddress);
      expect(positionAfter).toBeGreaterThan(positionBefore);
    });
  },
);
