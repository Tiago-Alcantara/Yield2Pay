'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** O primeiro acesso real abre no painel, depois do login. */
export default function FamilyOnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return null;
}
