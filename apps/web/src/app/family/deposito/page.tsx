'use client';

/**
 * Depósito por PIX a partir do painel — /family/deposito
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

export default function FamilyDepositPage() {
  const router = useRouter();
  const { t, addDeposit } = useFamily();

  function handleConfirm(amount: number) {
    if (amount > 0) addDeposit(amount);
    router.push('/family/dashboard');
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
      <div className="fam-center-shell">
        <div style={{ marginBottom: 'clamp(22px,5vw,34px)' }}>
          <FamilyBrand tag={t.brandTag} size={20} href="/family/dashboard" />
        </div>
        <PixDepositCard
          fromApp
          onConfirm={handleConfirm}
          onBack={() => router.push('/family/dashboard')}
        />
      </div>
    </div>
  );
}
