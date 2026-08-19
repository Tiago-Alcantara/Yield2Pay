export type BillType = 'software' | 'utility' | 'other';
export interface RegisterWalletDto { stellarAddress: string; }
export interface BuildTxResponse { xdr: string; hash: string; }
export interface SubmitTxDto { xdr: string; signatureHex: string; stellarAddress: string; amount: string; rampOrderId?: string; }
export interface SubmitTxResponse { txHash: string; }
export interface CreateBillDto { vendor: string; monthlyCost: string; type: BillType; }
export interface Bill { id: string; vendor: string; monthlyCost: string; type: BillType; status: string; }
export interface SpendableView { vaultValue: string; principal: string; spendable: string; apyPercent: string; returnsChangePercent: string | null; }
export interface WalletBalanceView { balance: string; spendable: string; }

// ── Ramp (Etherfuse on/off-ramp) ──────────────────────────────────────────────
export interface RampStatus { onboarded: boolean; kycStatus: string | null; ready: boolean; fiatCurrency: string; }
export interface RampSetupResult { onboardingUrl: string; customerId: string; ready: boolean; }
export interface OnrampResult {
  orderId: string; quoteId: string; fiatCurrency: string; targetAmount: string; feeAmount: string;
  depositClabe: string; depositBankName: string; statusPage: string; expiresAt: string;
}
export interface OfframpResult {
  orderId: string; quoteId: string; fiatCurrency: string; targetAmount: string; feeAmount: string;
  burnTransaction: string | null; statusPage: string; expiresAt: string;
}
export interface RampOrderStatus { orderId: string; status: string; burnTransaction?: string; }
export interface OrderClaim { skip: boolean; xdr?: string; hash?: string; }
export interface OrderBurn { ready: boolean; xdr?: string; hash?: string; }
export interface SubmitClaimDto { xdr: string; signatureHex: string; stellarAddress: string; }
export interface RampOrder {
  id: string; orderId: string; type: string; status: string;
  amountFiat: string | null; amountToken: string | null; createdAt: string;
}

// ── Erros (contrato entre a API e as telas de erro) ───────────────────────────

/** Ambiente lógico da aplicação. Governa quanto detalhe o erro expõe. */
export type AppEnv = 'production' | 'staging' | 'development';

/**
 * Conjunto fechado de status que as telas de erro sabem apresentar. O filter da
 * API normaliza qualquer outro status para um destes antes de responder.
 */
export type ErrorStatusCode = 400 | 401 | 403 | 404 | 408 | 500 | 502 | 503;

/** Bloco de depuração — presente apenas fora de produção. */
export interface ErrorTechnicalDetails {
  method: string;
  endpoint: string;
  requestId: string;
  message: string;
  stack: string;
}

/** Corpo de toda resposta de erro da API. */
export interface ApiErrorPayload {
  statusCode: ErrorStatusCode;
  errorId: string;
  timestamp: string;
  /**
   * Mensagem segura para o usuário. As telas usam a cópia própria de
   * STATUS_COPY; este campo serve ao tratamento inline que já existe.
   */
  message: string;
  technicalDetails?: ErrorTechnicalDetails;
}
