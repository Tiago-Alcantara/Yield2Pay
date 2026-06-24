import { VaultService } from './vault.service';
import { SupportedNetworks } from '@defindex/sdk';

const VAULT_ADDR = 'CVAULTADDRESS';
const USDC_ADDR = 'CUSDCADDRESS';
const CALLER = 'GCALLERADDRESS';

/**
 * Build a mock SDK whose methods are jest.fn() stubs returning the
 * shapes that the REAL @defindex/sdk v0.3.0 returns.
 */
function makeSdkMock() {
  return {
    depositToVault: jest.fn(),
    withdrawFromVault: jest.fn(),
    getVaultAPY: jest.fn(),
    getVaultBalance: jest.fn(),
  };
}

function makeConfig(network: 'testnet' | 'public' = 'testnet') {
  return {
    defindexApiKey: 'sk-test',
    defindexBaseUrl: 'https://api.defindex.io',
    vaultAddress: VAULT_ADDR,
    usdcAddress: USDC_ADDR,
    stellarNetwork: network,
  } as any;
}

describe('VaultService', () => {
  describe('buildDeposit', () => {
    it('calls depositToVault with correct args and returns xdr (testnet)', async () => {
      const sdk = makeSdkMock();
      sdk.depositToVault.mockResolvedValue({ xdr: 'AAAAADEPOSIT==', simulationResponse: {} });
      const svc = new VaultService(sdk as any, makeConfig('testnet'));

      const result = await svc.buildDeposit(CALLER, 5_000_000n);

      expect(sdk.depositToVault).toHaveBeenCalledWith(
        VAULT_ADDR,
        { amounts: [5_000_000], caller: CALLER, invest: true, slippageBps: 50 },
        SupportedNetworks.TESTNET,
      );
      expect(result).toEqual({ xdr: 'AAAAADEPOSIT==' });
    });

    it('calls depositToVault with MAINNET when stellarNetwork=public', async () => {
      const sdk = makeSdkMock();
      sdk.depositToVault.mockResolvedValue({ xdr: 'AAAAAMAINNETDEPOSIT==', simulationResponse: {} });
      const svc = new VaultService(sdk as any, makeConfig('public'));

      await svc.buildDeposit(CALLER, 1_000_000n);

      expect(sdk.depositToVault).toHaveBeenCalledWith(
        VAULT_ADDR,
        expect.any(Object),
        SupportedNetworks.MAINNET,
      );
    });

    it('throws when SDK returns null xdr', async () => {
      const sdk = makeSdkMock();
      sdk.depositToVault.mockResolvedValue({ xdr: null, simulationResponse: {} });
      const svc = new VaultService(sdk as any, makeConfig());

      await expect(svc.buildDeposit(CALLER, 1_000_000n)).rejects.toThrow(
        'depositToVault returned null xdr',
      );
    });
  });

  describe('buildWithdraw', () => {
    it('calls withdrawFromVault with correct args and returns xdr', async () => {
      const sdk = makeSdkMock();
      sdk.withdrawFromVault.mockResolvedValue({ xdr: 'AAAAWITHDRAW==', simulationResponse: {} });
      const svc = new VaultService(sdk as any, makeConfig('testnet'));

      const result = await svc.buildWithdraw(CALLER, 2_000_000n);

      expect(sdk.withdrawFromVault).toHaveBeenCalledWith(
        VAULT_ADDR,
        { amounts: [2_000_000], caller: CALLER, slippageBps: 50 },
        SupportedNetworks.TESTNET,
      );
      expect(result).toEqual({ xdr: 'AAAAWITHDRAW==' });
    });

    it('throws when SDK returns null xdr', async () => {
      const sdk = makeSdkMock();
      sdk.withdrawFromVault.mockResolvedValue({ xdr: null, simulationResponse: {} });
      const svc = new VaultService(sdk as any, makeConfig());

      await expect(svc.buildWithdraw(CALLER, 1_000_000n)).rejects.toThrow(
        'withdrawFromVault returned null xdr',
      );
    });
  });

  describe('getApyPercent', () => {
    it('returns apy from SDK as a string', async () => {
      const sdk = makeSdkMock();
      sdk.getVaultAPY.mockResolvedValue({ apy: 7.25 });
      const svc = new VaultService(sdk as any, makeConfig());

      const apy = await svc.getApyPercent();

      expect(sdk.getVaultAPY).toHaveBeenCalledWith(VAULT_ADDR, SupportedNetworks.TESTNET);
      expect(apy).toBe('7.25');
    });
  });

  describe('getPositionValue', () => {
    it('returns dfTokens as bigint (PLACEHOLDER — raw shares, not underlying USDC)', async () => {
      const sdk = makeSdkMock();
      // dfTokens is number per VaultBalanceResponse
      sdk.getVaultBalance.mockResolvedValue({ dfTokens: 123456, underlyingBalance: [123456] });
      const svc = new VaultService(sdk as any, makeConfig());

      const result = await svc.getPositionValue('GUSER...');

      expect(sdk.getVaultBalance).toHaveBeenCalledWith(
        VAULT_ADDR,
        'GUSER...',
        SupportedNetworks.TESTNET,
      );
      // PLACEHOLDER: returns raw share count as bigint; must be replaced with
      // real shares→underlying conversion once DeFindex testnet credentials exist.
      expect(result).toBe(123456n);
    });
  });
});
