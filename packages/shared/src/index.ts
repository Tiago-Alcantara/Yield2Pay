export type BillType = 'software' | 'utility' | 'other';
export interface RegisterWalletDto { stellarAddress: string; }
export interface BuildTxResponse { xdr: string; hash: string; }
export interface SubmitTxDto { xdr: string; signatureHex: string; stellarAddress: string; amount: string; }
export interface CreateBillDto { vendor: string; monthlyCost: string; type: BillType; }
export interface SpendableView { vaultValue: string; principal: string; spendable: string; apyPercent: string; }
