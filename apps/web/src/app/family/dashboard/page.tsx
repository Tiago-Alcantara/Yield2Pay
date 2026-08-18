'use client';

/**
 * Painel da família — /family/dashboard
 *
 * Reproduz a tela "dashboard" de design/nemPages/Yield2Pay Famílias App.dc.html:
 * percentual de liberdade, saldo, o cofre (DeFindex, ainda mock) e a lista de
 * assinaturas ordenada por prioridade.
 */

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, PANEL_SHADOW_LG, cardLabel } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { fmtBRL, fmtBRLShort, numericOnly, parseBRL } from '../_lib/familyFormat';
import {
  coverageRows,
  coveredAmount,
  freedomPercent,
  monthlyTotalOf,
  monthlyYieldOf,
} from '../_lib/familyMath';
import {
  CoverageBar,
  MetalPanel,
  StatCard,
  StatusPill,
  SubDot,
} from '../_components/FamilyUI';
import { DashboardHeader } from '../_components/DashboardHeader';

export default function FamilyDashboardPage() {
  const router = useRouter();
  const { t, state, addSub } = useFamily();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const { deposit, rate, subs } = state;

  const view = useMemo(() => {
    const yieldPerMonth = monthlyYieldOf(deposit, rate);
    const monthly = monthlyTotalOf(subs);
    return {
      yieldPerMonth,
      monthly,
      paid: coveredAmount(monthly, yieldPerMonth),
      pct: freedomPercent(monthly, yieldPerMonth),
      rows: coverageRows(subs, deposit, rate),
    };
  }, [deposit, rate, subs]);

  const rateLabel = `${rate}%`;

  function handleAdd() {
    const price = parseBRL(newPrice);
    const name = newName.trim();
    if (!name || price <= 0) return;
    addSub({ name, price, dia: 1 });
    setNewName('');
    setNewPrice('');
    setAdding(false);
  }

  const movements = [
    {
      key: 'yield',
      label: t.dash.movYield,
      sub: t.dash.movYieldSub,
      value: `+ ${fmtBRL(view.paid)}`,
      positive: true,
    },
    ...view.rows
      .filter((r) => r.covered)
      .slice(0, 3)
      .map((r) => ({
        key: r.id,
        label: r.name,
        sub: t.dash.movAuto,
        value: `− ${fmtBRL(r.price)}`,
        positive: false,
      })),
    {
      key: 'deposit',
      label: t.dash.movDeposit,
      sub: t.dash.movDepositSub,
      value: `+ ${fmtBRLShort(deposit)}`,
      positive: true,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
      <DashboardHeader />

      <main
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '24px var(--fam-gutter) 72px',
        }}
      >
        {/* ── Percentual de liberdade + saldos ──────────────────────────── */}
        <div className="fam-dash-top">
          <MetalPanel radius={22} padding="var(--fam-panel-pad)" shadow={PANEL_SHADOW_LG}>
            <div style={{ ...cardLabel, letterSpacing: '.16em', color: C.text2 }}>
              {t.dash.freedomLabel}
            </div>
            <div
              style={{
                fontFamily: C.mono,
                fontSize: 'clamp(44px,14vw,60px)',
                fontWeight: 600,
                color: C.textStrong,
                marginTop: 12,
                lineHeight: 1,
                letterSpacing: '-.01em',
                textShadow: '0 1px 0 rgba(0,0,0,.4)',
              }}
            >
              {view.pct}%
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: C.textSoft, marginTop: 10 }}>
              {view.pct >= 100 ? t.dash.freedomFull : t.dash.freedomPartial}
            </div>
            <div style={{ marginTop: 20 }}>
              <CoverageBar percent={view.pct} />
            </div>
            <div
              style={{
                fontFamily: C.mono,
                fontSize: 11,
                letterSpacing: '.1em',
                color: C.text3,
                marginTop: 12,
              }}
            >
              {t.dash.scenarioNote(rateLabel)}
            </div>
          </MetalPanel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <StatCard
              label={t.dash.balanceLabel}
              value={fmtBRLShort(deposit)}
              sub={t.dash.balanceSub}
            />
            <StatCard label={t.dash.paidLabel} value={fmtBRL(view.paid)} sub={t.dash.paidSub} />
          </div>
        </div>

        {/* ── Cofre ─────────────────────────────────────────────────────── */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: 'var(--fam-card-pad)',
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, color: C.textStrong, letterSpacing: '-.01em' }}>
                {t.dash.vaultTitle}
              </div>
              <div style={{ fontSize: 13.5, color: C.text2, marginTop: 4 }}>{t.dash.vaultSub}</div>
            </div>
            <span
              style={{
                fontFamily: C.mono,
                fontSize: 10.5,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: C.text2,
                border: `1px solid ${C.border}`,
                borderRadius: 999,
                padding: '5px 12px',
              }}
            >
              {t.dash.vaultBadge}
            </span>
          </div>

          <div className="fam-vault-grid" style={{ marginTop: 20 }}>
            <div
              style={{
                background: C.well,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: 'clamp(18px,4vw,22px)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={cardLabel}>{t.dash.vaultStored}</div>
              <div
                style={{
                  fontFamily: C.mono,
                  fontSize: 'clamp(24px,7vw,30px)',
                  fontWeight: 600,
                  color: C.textStrong,
                  marginTop: 10,
                }}
              >
                {fmtBRLShort(deposit)}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: C.text2, marginTop: 6 }}>
                {t.dash.vaultNote}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginTop: 'auto',
                  paddingTop: 18,
                }}
              >
                <button
                  type="button"
                  className="btn-shine"
                  onClick={() => router.push('/family/deposito')}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: C.chromeInk,
                    background: C.chromeSoft,
                    border: 'none',
                    borderRadius: 12,
                    padding: '13px 22px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 0 rgba(255,255,255,.5) inset,0 8px 22px rgba(0,0,0,.4)',
                  }}
                >
                  {t.dash.vaultDeposit}
                </button>
                <button
                  type="button"
                  className="fam-outline"
                  onClick={() => router.push('/family/saque')}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: C.textStrong,
                    background: 'rgba(255,255,255,.03)',
                    border: `1px solid ${C.borderMetal}`,
                    borderRadius: 12,
                    padding: '13px 22px',
                    cursor: 'pointer',
                    transition: 'border-color .2s ease',
                  }}
                >
                  {t.dash.vaultWithdraw}
                </button>
              </div>
            </div>

            <div
              style={{
                background: C.well,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: 'clamp(18px,4vw,22px)',
              }}
            >
              <div style={cardLabel}>{t.dash.movTitle}</div>
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
                {movements.map((m) => (
                  <div
                    key={m.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 0',
                      borderBottom: `1px solid ${C.borderFainter}`,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>
                        {m.label}
                      </span>
                      <span style={{ display: 'block', fontSize: 12, color: C.text3, marginTop: 2 }}>
                        {m.sub}
                      </span>
                    </span>
                    <span
                      style={{
                        fontFamily: C.mono,
                        fontSize: 13.5,
                        whiteSpace: 'nowrap',
                        color: m.positive ? C.textStrong : C.text2,
                      }}
                    >
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.5, color: C.text4, marginTop: 12 }}>
                {t.dash.scenarioNoteShort(rateLabel)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Assinaturas ───────────────────────────────────────────────── */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: 'var(--fam-card-pad)',
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, color: C.textStrong, letterSpacing: '-.01em' }}>
                {t.dash.subsTitle}
              </div>
              <div style={{ fontSize: 13.5, color: C.text2, marginTop: 4 }}>
                {t.dash.subsTotal(fmtBRL(view.monthly))}
              </div>
            </div>
            <button
              type="button"
              className="fam-outline"
              onClick={() => setAdding((v) => !v)}
              style={{
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                color: C.textStrong,
                background: 'rgba(255,255,255,.03)',
                border: `1px solid ${C.borderMetal}`,
                borderRadius: 999,
                padding: '10px 18px',
                cursor: 'pointer',
                transition: 'border-color .2s ease',
              }}
            >
              {adding ? t.dash.subsClose : t.dash.subsAdd}
            </button>
          </div>

          {adding && (
            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                marginTop: 18,
                padding: 16,
                background: C.well,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
              }}
            >
              <input
                className="fam-field"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t.dash.subsNamePlaceholder}
                aria-label={t.dash.subsNameAria}
                style={{
                  flex: 2,
                  minWidth: 180,
                  background: C.wellDeep,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: C.textStrong,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <input
                className="fam-field"
                type="text"
                inputMode="numeric"
                value={newPrice}
                onChange={(e) => setNewPrice(numericOnly(e.target.value))}
                placeholder={t.dash.subsPricePlaceholder}
                aria-label={t.dash.subsPriceAria}
                style={{
                  flex: 1,
                  minWidth: 120,
                  background: C.wellDeep,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: C.textStrong,
                  fontFamily: C.mono,
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                className="btn-shine"
                onClick={handleAdd}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.chromeInk,
                  background: C.chromeSoft,
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 20px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 0 rgba(255,255,255,.5) inset',
                }}
              >
                {t.dash.subsAddCta}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
            {view.rows.length === 0 && (
              <div style={{ fontSize: 14, color: C.text2, padding: '16px 4px' }}>{t.dash.empty}</div>
            )}
            {view.rows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="fam-row fam-sub-row"
                onClick={() => router.push(`/family/dashboard/${encodeURIComponent(row.id)}`)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  borderBottom: `1px solid ${C.borderFaint}`,
                  padding: '16px 4px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background .2s ease',
                }}
              >
                <SubDot on={row.covered} />
                <span className="fam-sub-main">
                  <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: C.textStrong }}>
                    {row.name}
                  </span>
                  <span style={{ display: 'block', fontSize: 12.5, color: C.text3, marginTop: 2 }}>
                    {row.covered
                      ? t.dash.subsHintCovered
                      : t.dash.subsHintMissing(fmtBRLShort(row.missing))}
                  </span>
                </span>
                <span
                  className="fam-sub-price"
                  style={{ fontFamily: C.mono, fontSize: 14, color: C.silver }}
                >
                  {fmtBRLShort(row.price)}
                </span>
                <StatusPill covered={row.covered}>
                  {row.covered ? t.dash.statusCovered : t.dash.statusNotYet}
                </StatusPill>
                <span
                  aria-hidden="true"
                  className="fam-hide-sm"
                  style={{ color: C.placeholder, fontSize: 16 }}
                >
                  ›
                </span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: C.text4, marginTop: 16 }}>
            {t.dash.subsFooter}
          </div>
        </div>
      </main>
    </div>
  );
}
