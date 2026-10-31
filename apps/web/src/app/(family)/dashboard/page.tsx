'use client';

import { Suspense } from 'react';
import PainelGastos from './PainelGastos';

/** Painel de gastos da família — /dashboard */
export default function FamilyDashboardPage() {
  return (
    <Suspense fallback={null}>
      <PainelGastos />
    </Suspense>
  );
}
