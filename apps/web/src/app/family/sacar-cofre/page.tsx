'use client';

/**
 * Sacar do cofre on-chain — /family/sacar-cofre
 *
 * Resgate via venue (Stellar Blend / Solana Kamino), não PIX.
 * Requer Privy configurado para assinar transações.
 */

import React from 'react';
import { VenueMoveForm } from '../_components/VenueMoveForm';

export default function FamilyVaultWithdrawPage() {
  return <VenueMoveForm mode="withdraw" />;
}
