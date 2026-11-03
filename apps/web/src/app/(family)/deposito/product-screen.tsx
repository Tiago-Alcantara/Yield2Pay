'use client';

/**
 * Depósito por PIX a partir do painel — /deposito
 *
 * Mesma tela do último passo do onboarding, com o título de "Depositar por PIX"
 * e a saída "Voltar sem depositar".
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { C } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { FamilyBrand } from '../_components/FamilyUI';
import { PixDepositCard } from '../_components/PixDepositCard';
import { useTopProgress } from '../_components/loading/TopProgress';

export default function FamilyDepositPage() {
  const router = useRouter();
  const topProgress = useTopProgress();
  const { t, addDeposit } = useFamily();

  function backToDashboard() {
    topProgress.startNavigation('/dashboard');
    router.push('/dashboard');
  }

  function handleConfirm(amount: number) {
    if (amount > 0) addDeposit(amount);
    backToDashboard();
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
      <div className="fam-center-shell">
        <div style={{ marginBottom: 'clamp(22px,5vw,34px)' }}>
          <FamilyBrand tag={t.brandTag} size={20} href="/dashboard" />
        </div>
        <PixDepositCard
          fromApp
          onConfirm={handleConfirm}
          onBack={backToDashboard}
        />
      </div>
    </div>
  );
}
