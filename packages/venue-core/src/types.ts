export type ChainId = "stellar" | "solana";

export type VenueId = "stellar:blend" | "solana:kamino";

export type VenueMode = "live" | "mock";

export type AssetId = "USDC";

export type Money = {
  amount: bigint;
  decimals: number;
  asset: AssetId;
  chainId: ChainId;
};

export type UnsignedTx =
  | { chain: "stellar"; xdr: string; hash: string }
  | { chain: "solana"; transactionBase64: string };

export type SignedTx =
  | { chain: "stellar"; xdr: string; signatureHex: string; address: string }
  | { chain: "solana"; signedTransactionBase64: string };

export type VenueCapabilities = {
  ramp: boolean;
  mock: boolean;
};

export type StellarLiveAdapter = {
  buildDeposit(
    owner: string,
    amount: bigint,
  ): Promise<{ xdr: string; hash: string }>;
  buildWithdraw(
    owner: string,
    amount: bigint,
  ): Promise<{ xdr: string; hash: string }>;
  submit(
    xdr: string,
    address: string,
    signatureHex: string,
  ): Promise<{ txRef: string }>;
  getApyPercent(): Promise<string>;
  getPositionValue(owner: string): Promise<bigint>;
};

export type SolanaLiveAdapter = {
  buildDeposit(
    owner: string,
    amount: bigint,
  ): Promise<{ transactionBase64: string }>;
  buildWithdraw(
    owner: string,
    amount: bigint,
  ): Promise<{ transactionBase64: string }>;
  submit(signedTransactionBase64: string): Promise<{ txRef: string }>;
  getApyPercent(): Promise<string>;
  getPositionValue(owner: string): Promise<bigint>;
};

export type VenuePlugin = {
  id: VenueId;
  chainId: ChainId;
  protocol: string;
  privyChainType: string;
  mode: VenueMode;
  capabilities: VenueCapabilities;
  registerWallet(accountId: string, address: string): Promise<void>;
  buildDeposit(owner: string, amount: Money): Promise<UnsignedTx>;
  buildWithdraw(owner: string, amount: Money): Promise<UnsignedTx>;
  submit(signed: SignedTx): Promise<{ txRef: string }>;
  getApyPercent(): Promise<string>;
  getPositionValue(owner: string): Promise<Money>;
};
