'use client';

/**
 * Saque por PIX — /family/saque
 *
 * O botão "Sacar meu saldo" existe no painel do design, mas a tela em si não
 * foi desenhada. Esta é a versão mínima na mesma linguagem visual, para o fluxo
 * não terminar em beco sem saída: valor, chave PIX de destino e confirmação.
 * Quando DeFindex entrar, `withdraw()` vira o resgate no cofre.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, CHROME_SHADOW, cardLabel } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { fmtBRL, numericOnly, parseBRL } from '../_lib/familyFormat';
import { FamilyBrand } from '../_components/FamilyUI';

export default function FamilyWithdrawPage() {
  const router = useRouter();
  const { t, state, withdraw } = useFamily();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(false);

  const parsed = parseBRL(amount);

  function handleConfirm() {
    if (parsed < 1 || parsed > state.deposit) {
      setError(true);
      return;
    }
    withdraw(parsed);
    router.push('/family/dashboard');
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <div style={{ marginBottom: 34 }}>
          <FamilyBrand tag={t.brandTag} size={20} href="/family/dashboard" />
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 24px 56px rgba(0,0,0,.5)',
          }}
        >
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: '-.02em',
              margin: 0,
              color: C.textStrong,
              textWrap: 'balance',
            }}
          >
            {t.withdraw.title}
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text2, margin: '10px 0 0' }}>
            {t.withdraw.sub}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              margin: '22px 0 8px',
            }}
          >
            <label htmlFor="fam-saque-valor" style={cardLabel}>
              {t.withdraw.amountLabel}
            </label>
            <button
              type="button"
              className="fam-quiet"
              onClick={() => {
                setAmount(String(state.deposit).replace('.', ','));
                setError(false);
              }}
              style={{
                fontFamily: C.mono,
                fontSize: 11.5,
                color: C.silver,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {t.withdraw.allLabel}
            </button>
          </div>
          <input
            id="fam-saque-valor"
            className="fam-field"
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(numericOnly(e.target.value));
              setError(false);
            }}
            placeholder="0"
            aria-invalid={error}
            style={{
              width: '100%',
              background: C.well,
              border: `1px solid ${error ? C.inputError : C.border}`,
              borderRadius: 12,
              padding: '13px 14px',
              color: C.textStrong,
              fontFamily: C.mono,
              fontSize: 16,
              outline: 'none',
            }}
          />
          {error && (
            <div role="alert" style={{ fontSize: 12.5, color: C.danger, marginTop: 8 }}>
              {t.withdraw.errorAmount}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 10,
              fontFamily: C.mono,
              fontSize: 11.5,
              color: C.text4,
            }}
          >
            <span>{t.withdraw.available}</span>
            <span>{fmtBRL(state.deposit)}</span>
          </div>

          <div
            style={{
              marginTop: 18,
              background: C.well,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div style={cardLabel}>{t.withdraw.keyLabel}</div>
            <div style={{ fontFamily: C.mono, fontSize: 14, color: C.textStrong, marginTop: 6 }}>
              {state.pixKey}
            </div>
          </div>

          <button
            type="button"
            className="btn-shine"
            onClick={handleConfirm}
            style={{
              width: '100%',
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 600,
              color: C.chromeInk,
              background: C.chromeSoft,
              border: 'none',
              borderRadius: 12,
              padding: 14,
              cursor: 'pointer',
              marginTop: 20,
              boxShadow: CHROME_SHADOW,
            }}
          >
            {t.withdraw.confirm}
          </button>
          <button
            type="button"
            className="fam-quiet"
            onClick={() => router.push('/family/dashboard')}
            style={{
              width: '100%',
              fontFamily: 'inherit',
              fontSize: 14,
              color: C.text2,
              background: 'none',
              border: 'none',
              padding: '12px 0 0',
              cursor: 'pointer',
            }}
          >
            {t.withdraw.back}
          </button>
          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              color: C.text4,
              textAlign: 'center',
              marginTop: 12,
            }}
          >
            {t.withdraw.note}
          </div>
        </div>
      </div>
    </div>
  );
}
