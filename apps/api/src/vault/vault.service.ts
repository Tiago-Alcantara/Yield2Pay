import { Inject, Injectable } from '@nestjs/common';
import { DefindexSDK, SupportedNetworks } from '@defindex/sdk';
import type { Env } from '../config/env';
import { APP_CONFIG } from '../config/config.module';

export const DEFINDEX_SDK = 'DEFINDEX_SDK';

/**
 * Maps the app's stellarNetwork string to the SDK's SupportedNetworks enum.
 * 'testnet' → SupportedNetworks.TESTNET
 * 'public'  → SupportedNetworks.MAINNET
 */
function toSdkNetwork(network: Env['stellarNetwork']): SupportedNetworks {
  return network === 'testnet' ? SupportedNetworks.TESTNET : SupportedNetworks.MAINNET;
}

const DEFAULT_SLIPPAGE_BPS = 50;

@Injectable()
export class VaultService {
  private readonly network: SupportedNetworks;
  private readonly vaultAddress: string;

  constructor(
    @Inject(DEFINDEX_SDK) private readonly sdk: DefindexSDK,
    @Inject(APP_CONFIG) private readonly cfg: Env,
  ) {
    this.network = toSdkNetwork(cfg.stellarNetwork);
    this.vaultAddress = cfg.vaultAddress;
  }

  /**
   * Build a deposit transaction XDR.
   * Returns { xdr } for the caller to sign and submit.
   */
  async buildDeposit(caller: string, amount: bigint): Promise<{ xdr: string }> {
    const response = await this.sdk.depositToVault(
      this.vaultAddress,
      {
        amounts: [Number(amount)],
        caller,
        invest: true,
        slippageBps: DEFAULT_SLIPPAGE_BPS,
      },
      this.network,
    );

    if (response.xdr === null) {
      throw new Error('depositToVault returned null xdr');
    }

    return { xdr: response.xdr };
  }

  /**
   * Build a withdraw transaction XDR.
   * Returns { xdr } for the caller to sign and submit.
   */
  async buildWithdraw(caller: string, amount: bigint): Promise<{ xdr: string }> {
    const response = await this.sdk.withdrawFromVault(
      this.vaultAddress,
      {
        amounts: [Number(amount)],
        caller,
        slippageBps: DEFAULT_SLIPPAGE_BPS,
      },
      this.network,
    );

    if (response.xdr === null) {
      throw new Error('withdrawFromVault returned null xdr');
    }

    return { xdr: response.xdr };
  }

  /**
   * Get the vault's current APY as a percentage string.
   * Returned as a string because downstream SpendableView.apyPercent is a
   * string surfaced directly by the dashboard.
   */
  async getApyPercent(): Promise<string> {
    const response = await this.sdk.getVaultAPY(this.vaultAddress, this.network);
    return String(response.apy);
  }

  /**
   * Get the user's position value in the vault.
   *
   * PLACEHOLDER: Returns raw dfTokens (vault shares) as bigint.
   * This does NOT represent the underlying USDC value.
   * Must be replaced with the real shares→underlying USDC conversion
   * once DeFindex testnet credentials are available and the integration
   * test in apps/api/test/vault.integration-spec.ts is run.
   *
   * See: apps/api/test/vault.integration-spec.ts for the deferred
   * integration test that pins this conversion.
   */
  async getPositionValue(userAddress: string): Promise<bigint> {
    const response = await this.sdk.getVaultBalance(
      this.vaultAddress,
      userAddress,
      this.network,
    );
    // PLACEHOLDER: dfTokens is raw vault share count, not underlying USDC.
    // Replace with underlyingBalance[0] (or a proper conversion) once confirmed
    // via testnet integration test.
    return BigInt(response.dfTokens);
  }
}
