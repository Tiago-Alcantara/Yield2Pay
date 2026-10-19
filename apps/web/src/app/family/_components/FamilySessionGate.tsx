'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';

export function FamilySessionGate({ children }: { children: React.ReactNode }) {
  if (!isPrivyConfigured) {
    return <>{children}</>;
  }
  return <ConfiguredFamilySessionGate>{children}</ConfiguredFamilySessionGate>;
}

function ConfiguredFamilySessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace('/login');
    }
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) return null;
  return <>{children}</>;
}
