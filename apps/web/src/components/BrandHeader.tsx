import React from 'react';
import { BackButton } from './BackButton';

/**
 * Cabeçalho de marca compartilhado pelas telas de depósito e saque:
 * botão de voltar + losango chrome + wordmark "Yield2Pay", centralizado.
 * O wrapper é `position: relative` para o BackButton absoluto ancorar à esquerda.
 */
export function BrandHeader() {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 26,
      }}
    >
      <BackButton />
      <span
        style={{
          width: 12,
          height: 12,
          background: 'var(--fx-chrome)',
          transform: 'rotate(45deg)',
          borderRadius: 2,
          boxShadow: 'var(--fx-glow-silver)',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--fx-font-display)',
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '-.01em',
          color: 'var(--fx-text)',
        }}
      >
        Yield2Pay
      </span>
    </div>
  );
}
