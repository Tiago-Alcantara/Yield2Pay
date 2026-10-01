import type {
  Bill,
  BuildTxResponse,
  CreateBillDto,
  OfframpResult,
  OnrampResult,
  OrderBurn,
  OrderClaim,
  RampOrderStatus,
  RampSetupResult,
  RampStatus,
  RegisterWalletDto,
  SpendableView,
  SubmitClaimDto,
  SubmitTxDto,
  SubmitTxResponse,
  WalletBalanceView,
} from '@yield2pay/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`ApiError: ${status}`);
  }
}

type GetToken = () => Promise<string | null>;

export interface YieldApi {
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
  getRampStatus(): Promise<RampStatus>;
  rampSetup(body: { email: string; displayName: string }): Promise<RampSetupResult>;
  startOnramp(body: { amountFiat: string }): Promise<OnrampResult>;
  simulateFiatReceived(body: { orderId: string }): Promise<void>;
  startOfframp(body: { amountToken: string }): Promise<OfframpResult>;
  getRampOrder(orderId: string): Promise<RampOrderStatus>;
  getOrderClaim(orderId: string): Promise<OrderClaim>;
  submitOrderClaim(orderId: string, body: SubmitClaimDto): Promise<{ txHash: string }>;
  getOrderBurn(orderId: string): Promise<OrderBurn>;
  submitOrderBurn(orderId: string, body: SubmitClaimDto): Promise<{ txHash: string }>;
}

export function createApi(options: {
  baseUrl: string;
  getToken: GetToken;
  fetchImpl?: typeof fetch;
}): YieldApi {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<T> {
    const token = await options.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetchImpl(`${options.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new ApiError(response.status, errorBody);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  return {
    registerWallet: (body) => request('/wallet', 'POST', body),
    buildDeposit: (amount) => request('/deposit/build', 'POST', { amount }),
    submitDeposit: (body) => request('/deposit/submit', 'POST', body),
    buildWithdraw: (amount) => request('/withdraw/build', 'POST', { amount }),
    submitWithdraw: (body) => request('/withdraw/submit', 'POST', body),
    getDashboard: () => request('/dashboard', 'GET'),
    getWalletBalance: () => request('/wallet/balance', 'GET'),
    listBills: () => request('/bills', 'GET'),
    createBill: (body) => request('/bills', 'POST', body),
    deleteBill: (id) => request(`/bills/${id}`, 'DELETE'),
    getRampStatus: () => request('/ramp/status'),
    rampSetup: (body) => request('/ramp/setup', 'POST', body),
    startOnramp: (body) => request('/ramp/onramp/start', 'POST', body),
    simulateFiatReceived: (body) => request('/ramp/onramp/simulate', 'POST', body),
    startOfframp: (body) => request('/ramp/offramp/start', 'POST', body),
    getRampOrder: (orderId) => request(`/ramp/order/${orderId}`),
    getOrderClaim: (orderId) => request(`/ramp/order/${orderId}/claim`),
    submitOrderClaim: (orderId, body) => request(`/ramp/order/${orderId}/claim`, 'POST', body),
    getOrderBurn: (orderId) => request(`/ramp/order/${orderId}/burn`),
    submitOrderBurn: (orderId, body) => request(`/ramp/order/${orderId}/burn`, 'POST', body),
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const message = (error.body as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
    if (Array.isArray(message) && message.length) return String(message[0]);
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Algo deu errado. Tente de novo.';
}
