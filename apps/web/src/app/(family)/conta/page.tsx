'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** A conta abre no modal do painel. Este endereço só leva até lá. */
export default function ContaPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard?conta=1');
  }, [router]);
  return null;
}
