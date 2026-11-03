'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';
import { setAccountView } from '../_lib/accountStore';
import { AppSplash, resetAppSplash } from './loading/AppSplash';

/** A landing em / fica pública. O restante da família pede sessão. */
function isPublicFamilyPath(pathname: string): boolean {
  return pathname === '/';
}

export function FamilySessionGate({ children }: { children: React.ReactNode }) {
  if (!isPrivyConfigured) {
    return <>{children}</>;
  }
  return <ConfiguredFamilySessionGate>{children}</ConfiguredFamilySessionGate>;
}

function ConfiguredFamilySessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, authenticated } = usePrivy();
  const isPublic = isPublicFamilyPath(pathname);

  useEffect(() => {
    if (isPublic || !ready || authenticated) return;
    setAccountView(null);
    resetAppSplash();
    router.replace(`/login?next=${encodeURIComponent(pathname || '/dashboard')}`);
  }, [isPublic, ready, authenticated, router, pathname]);

  if (isPublic || (ready && authenticated)) return <>{children}</>;
  // markSeen={false}: se este splash sair por causa do redirect para /login, ele volta depois do login.
  return <AppSplash loading markSeen={false} />;
}
