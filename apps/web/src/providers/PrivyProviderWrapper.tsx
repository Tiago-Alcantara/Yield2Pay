'use client';

import { PrivyProvider } from '@privy-io/react-auth';

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// A real Privy app id is a ~25-char token (e.g. "cmxxxxxxxxxxxxxxxxxxxxxxx").
// Without a valid one, mounting PrivyProvider throws and takes the whole app
// down — including the public landing. Gate it so the app still renders for
// local preview; auth-dependent screens (login, the (app) group) require a
// real id set in apps/web/.env.local.
export const isPrivyConfigured =
  !!appId && appId !== 'placeholder-app-id' && appId.length >= 20;

export function PrivyProviderWrapper({ children }: { children: React.ReactNode }) {
  if (!isPrivyConfigured) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[Yield2Pay] NEXT_PUBLIC_PRIVY_APP_ID is missing or invalid — running without Privy. ' +
          'Set a real Privy app id in apps/web/.env.local to enable login and the authenticated screens.',
      );
    }
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['google'],
        appearance: { theme: 'dark', accentColor: '#C0C2C5' },
        embeddedWallets: {
          ethereum: { createOnLogin: 'off' },
          solana: { createOnLogin: 'off' },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
