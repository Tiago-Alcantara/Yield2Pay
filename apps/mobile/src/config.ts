const PLACEHOLDER = 'placeholder-app-id';

export function privyConfig(): { appId: string; clientId: string; configured: boolean } {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '';
  const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '';
  const configured =
    appId.length >= 20 &&
    appId !== PLACEHOLDER &&
    clientId.length >= 8 &&
    clientId !== PLACEHOLDER;
  return { appId, clientId, configured };
}

export function apiBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
}

export function biometricRequired(): boolean {
  return process.env.EXPO_PUBLIC_BIOMETRIC !== 'off';
}

export function rampSimulateEnabled(): boolean {
  return process.env.EXPO_PUBLIC_RAMP_SIMULATE === '1';
}

export const ASSOCIATED_HOST = process.env.EXPO_PUBLIC_ASSOCIATED_HOST || 'yield2pay.app';

export const BUNDLE_ID = 'com.yield2pay.app';

export const LEGAL_NOTE =
  'Ferramenta de pagamento não-custodial. Não somos instituição financeira e não administramos recursos de terceiros. O rendimento é variável e pode ser zero.';
