'use client';

/**
 * Investir no cofre on-chain — /family/investir
 *
 * Depósito via venue (Stellar Blend / Solana Kamino), não PIX.
 * Requer Privy configurado para assinar transações.
 */

import React from 'react';
import { VenueMoveForm } from '../_components/VenueMoveForm';

export default function FamilyInvestPage() {
  return <VenueMoveForm mode="deposit" />;
}
