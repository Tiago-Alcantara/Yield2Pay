import { VaultService } from './vault.service';
import { SupportedNetworks } from '@defindex/sdk';

const VAULT_ADDR = 'CVAULTADDRESS';
const USDC_ADDR = 'CUSDCADDRESS';
const CALLER = 'GCALLERADDRESS';

/**
 * Build a mock SDK whose methods are vi.fn() stubs returning the
 * shapes that the REAL @defindex/sdk v0.3.0 returns.
 */
function makeSdkMock() {
  return {
    depositToVault: vi.fn(),
    withdrawFromVault: vi.fn(),
    getVaultAPY: vi.fn(),
    getVaultBalance: vi.fn(),
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
      sdk.depositToVault.mockResolvedValue({
        xdr: 'AAAAADEPOSIT==',
        simulationResponse: {},
      });
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
      sdk.depositToVault.mockResolvedValue({
        xdr: 'AAAAAMAINNETDEPOSIT==',
        simulationResponse: {},
      });
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
      sdk.depositToVault.mockResolvedValue({
        xdr: null,
        simulationResponse: {},
      });
      const svc = new VaultService(sdk as any, makeConfig());

      await expect(svc.buildDeposit(CALLER, 1_000_000n)).rejects.toThrow(
        'depositToVault returned null xdr',
      );
    });
  });

  describe('buildWithdraw', () => {
    it('calls withdrawFromVault with correct args and returns xdr', async () => {
      const sdk = makeSdkMock();
      sdk.withdrawFromVault.mockResolvedValue({
        xdr: 'AAAAWITHDRAW==',
        simulationResponse: {},
      });
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
      sdk.withdrawFromVault.mockResolvedValue({
        xdr: null,
        simulationResponse: {},
      });
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

      expect(sdk.getVaultAPY).toHaveBeenCalledWith(
        VAULT_ADDR,
        SupportedNetworks.TESTNET,
      );
      expect(apy).toBe('7.25');
    });
  });

  describe('getPositionValue', () => {
    it('returns underlyingBalance[0] as bigint on testnet (real value, not raw dfTokens shares)', async () => {
      const sdk = makeSdkMock();
      // dfTokens (shares) differs from underlyingBalance (real value): the share
      // price drifted above 1 as the vault earned yield.
      sdk.getVaultBalance.mockResolvedValue({
        dfTokens: 4998749,
        underlyingBalance: [5000046],
      });
      const svc = new VaultService(sdk as any, makeConfig('testnet'));

      const result = await svc.getPositionValue('GUSER...');

      expect(sdk.getVaultBalance).toHaveBeenCalledWith(
        VAULT_ADDR,
        'GUSER...',
        SupportedNetworks.TESTNET,
      );
      // returns the underlying value, NOT the dfTokens share count
      expect(result).toBe(5000046n);
    });

    it('returns underlyingBalance[0] on mainnet too (real value, no placeholder guard)', async () => {
      const sdk = makeSdkMock();
      sdk.getVaultBalance.mockResolvedValue({
        dfTokens: 4998749,
        underlyingBalance: [5000046],
      });
      const svc = new VaultService(sdk as any, makeConfig('public'));

      const result = await svc.getPositionValue('GUSER...');

      expect(sdk.getVaultBalance).toHaveBeenCalledWith(
        VAULT_ADDR,
        'GUSER...',
        SupportedNetworks.MAINNET,
      );
      expect(result).toBe(5000046n);
    });

    it('returns 0n when the user has no position (empty underlyingBalance)', async () => {
      const sdk = makeSdkMock();
      sdk.getVaultBalance.mockResolvedValue({ dfTokens: 0, underlyingBalance: [] });
      const svc = new VaultService(sdk as any, makeConfig('testnet'));

      const result = await svc.getPositionValue('GUSER...');

      expect(result).toBe(0n);
    });
  });

  describe('buildDeposit / buildWithdraw — safe integer guard (I3)', () => {
    it('throws when deposit amount exceeds MAX_SAFE_INTEGER', async () => {
      const sdk = makeSdkMock();
      const svc = new VaultService(sdk as any, makeConfig('testnet'));
      const tooLarge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;

      await expect(svc.buildDeposit(CALLER, tooLarge)).rejects.toThrow(
        'amount exceeds safe integer range for SDK',
      );
      expect(sdk.depositToVault).not.toHaveBeenCalled();
    });

    it('throws when withdraw amount exceeds MAX_SAFE_INTEGER', async () => {
      const sdk = makeSdkMock();
      const svc = new VaultService(sdk as any, makeConfig('testnet'));
      const tooLarge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;

      await expect(svc.buildWithdraw(CALLER, tooLarge)).rejects.toThrow(
        'amount exceeds safe integer range for SDK',
      );
      expect(sdk.withdrawFromVault).not.toHaveBeenCalled();
    });

    it('does NOT throw at exactly MAX_SAFE_INTEGER', async () => {
      const sdk = makeSdkMock();
      sdk.depositToVault.mockResolvedValue({
        xdr: 'XDROK',
        simulationResponse: {},
      });
      const svc = new VaultService(sdk as any, makeConfig('testnet'));

      await expect(
        svc.buildDeposit(CALLER, BigInt(Number.MAX_SAFE_INTEGER)),
      ).resolves.toBeDefined();
    });
  });
});
