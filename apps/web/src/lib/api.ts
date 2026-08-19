import type {
  BuildTxResponse,
  SubmitTxDto,
  SubmitTxResponse,
  RegisterWalletDto,
  CreateBillDto,
  SpendableView,
  WalletBalanceView,
  Bill,
  RampStatus,
  RampSetupResult,
  OnrampResult,
  OfframpResult,
  RampOrderStatus,
  RampOrder,
  OrderClaim,
  OrderBurn,
  SubmitClaimDto,
} from '@yield2pay/shared';

import { ApiError } from './apiError';
import { buildErrorDetails } from './errorDetails';
import { publishErrorNotification } from './errorNotifications';

// Reexportado porque as telas e lib/errors.ts sempre importaram ApiError daqui.
export { ApiError };

type GetToken = () => Promise<string | null>;

interface ApiMethods {
  registerWallet(body: RegisterWalletDto): Promise<void>;
  buildDeposit(amount: string): Promise<BuildTxResponse>;
  submitDeposit(body: SubmitTxDto): Promise<SubmitTxResponse>;
  buildWithdraw(amount: string): Promise<BuildTxResponse>;
  submitWithdraw(body: SubmitTxDto): Promise<SubmitTxResponse>;
  getDashboard(): Promise<SpendableView>;
  getWalletBalance(): Promise<WalletBalanceView>;
  listBills(): Promise<Bill[]>;
  createBill(body: CreateBillDto): Promise<Bill>;
  deleteBill(id: string): Promise<void>;
  // Ramp
  getRampStatus(): Promise<RampStatus>;
  rampSetup(body: { email: string; displayName: string }): Promise<RampSetupResult>;
  rampMarkKycApproved(): Promise<void>;
  startOnramp(body: { amountFiat: string }): Promise<OnrampResult>;
  simulateFiatReceived(body: { orderId: string }): Promise<void>;
  startOfframp(body: { amountToken: string }): Promise<OfframpResult>;
  getRampOrder(orderId: string): Promise<RampOrderStatus>;
  listRampOrders(): Promise<RampOrder[]>;
  getOrderClaim(orderId: string): Promise<OrderClaim>;
  submitOrderClaim(orderId: string, body: SubmitClaimDto): Promise<{ txHash: string }>;
  getOrderBurn(orderId: string): Promise<OrderBurn>;
  submitOrderBurn(orderId: string, body: SubmitClaimDto): Promise<{ txHash: string }>;
}

export function createApi(getToken: GetToken): ApiMethods {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  async function request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<T> {
    const url = `${baseUrl}${endpoint}`;
    const token = await getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const fetchInit: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      fetchInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchInit);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const error = new ApiError(response.status, errorBody);
      // Toda falha de chamada abre o popup de erro; o throw continua para quem
      // já trata o erro inline na própria tela.
      publishErrorNotification(buildErrorDetails(error));
      throw error;
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  return {
    registerWallet: (body: RegisterWalletDto) =>
      request('/wallet', 'POST', body),

    buildDeposit: (amount: string) =>
      request('/deposit/build', 'POST', { amount }),

    submitDeposit: (body: SubmitTxDto) =>
      request('/deposit/submit', 'POST', body),

    buildWithdraw: (amount: string) =>
      request('/withdraw/build', 'POST', { amount }),

    submitWithdraw: (body: SubmitTxDto) =>
      request('/withdraw/submit', 'POST', body),

    getDashboard: () => request('/dashboard', 'GET'),

    getWalletBalance: () => request('/wallet/balance', 'GET'),

    listBills: () => request('/bills', 'GET'),

    createBill: (body: CreateBillDto) => request('/bills', 'POST', body),

    deleteBill: (id: string) => request(`/bills/${id}`, 'DELETE'),

    getRampStatus: () => request('/ramp/status'),
    rampSetup: (body) => request('/ramp/setup', 'POST', body),
    rampMarkKycApproved: () => request('/ramp/kyc-approved', 'POST'),
    startOnramp: (body) => request('/ramp/onramp/start', 'POST', body),
    simulateFiatReceived: (body) => request('/ramp/onramp/simulate', 'POST', body),
    startOfframp: (body) => request('/ramp/offramp/start', 'POST', body),
    getRampOrder: (orderId) => request(`/ramp/order/${orderId}`),
    listRampOrders: () => request('/ramp/orders'),
    getOrderClaim: (orderId) => request(`/ramp/order/${orderId}/claim`),
    submitOrderClaim: (orderId, body) =>
      request(`/ramp/order/${orderId}/claim`, 'POST', body),
    getOrderBurn: (orderId) => request(`/ramp/order/${orderId}/burn`),
    submitOrderBurn: (orderId, body) =>
      request(`/ramp/order/${orderId}/burn`, 'POST', body),
  };
}
