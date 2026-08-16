'use client';

/**
 * Detalhe de uma assinatura — /family/dashboard/[subId]
 *
 * "Quanto precisa estar depositado para esta conta se pagar sozinha", contando
 * as contas acima dela na ordem de prioridade.
 */

import React, { use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { C, PANEL_SHADOW_LG, cardLabel } from '../../_lib/familyTheme';
import { useFamily } from '../../_lib/FamilyProvider';
import { fmtBRL, fmtBRLShort } from '../../_lib/familyFormat';
import { coverageRows } from '../../_lib/familyMath';
import { CoverageBar, MetalPanel, StatusPill } from '../../_components/FamilyUI';

export default function FamilySubscriptionPage({
  params,
}: {
  params: Promise<{ subId: string }>;
}) {
  const { subId } = use(params);
  const router = useRouter();
  const { t, state } = useFamily();
  const { deposit, rate, subs } = state;

  const row = useMemo(() => {
    const id = decodeURIComponent(subId);
    return coverageRows(subs, deposit, rate).find((s) => s.id === id) ?? null;
  }, [subId, subs, deposit, rate]);

  const backLink = (
    <Link
      href="/family/dashboard"
      className="fam-quiet"
      style={{
        fontSize: 14,
        color: C.text2,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {t.detail.back}
    </Link>
  );

  if (!row) {
    return (
      <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
        <main style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 72px' }}>
          {backLink}
          <p style={{ fontSize: 16, color: C.text2, marginTop: 24 }}>{t.detail.notFound}</p>
        </main>
      </div>
    );
  }

  const progress =
    row.cumNeeded > 0 ? Math.min(100, Math.round((deposit / row.cumNeeded) * 100)) : 0;

  return (
    <div style={{ minHeight: '100vh', background: C.bgRadialTall }}>
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 72px' }}>
        {backLink}

        <div style={{ marginTop: 22 }}>
          <MetalPanel radius={22} padding={30} shadow={PANEL_SHADOW_LG}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <h1
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: '-.02em',
                    margin: 0,
                    color: C.textStrong,
                  }}
                >
                  {row.name}
                </h1>
                <div style={{ fontFamily: C.mono, fontSize: 14, color: C.silver, marginTop: 8 }}>
                  {fmtBRL(row.price)} {t.detail.perMonth}
                </div>
              </div>
              <StatusPill covered={row.covered}>
                {row.covered ? t.detail.statusCovered : t.detail.statusNotYet}
              </StatusPill>
            </div>

            <div style={{ marginTop: 24 }}>
              <CoverageBar percent={progress} />
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: C.textSoft, marginTop: 14 }}>
              {row.covered
                ? t.detail.lineCovered
                : t.detail.linePartial(progress, fmtBRLShort(row.missing))}
            </div>
          </MetalPanel>
        </div>

        <div className="fam-detail-stats" style={{ marginTop: 16 }}>
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              padding: 22,
            }}
          >
            <div style={cardLabel}>{t.detail.neededLabel}</div>
            <div
              style={{
                fontFamily: C.mono,
                fontSize: 26,
                fontWeight: 600,
                color: C.textStrong,
                marginTop: 10,
              }}
            >
              {fmtBRLShort(row.cumNeeded)}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.text2, marginTop: 6 }}>
              {t.detail.neededSub}
            </div>
          </div>
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              padding: 22,
            }}
          >
            <div style={cardLabel}>{t.detail.missingLabel}</div>
            <div
              style={{
                fontFamily: C.mono,
                fontSize: 26,
                fontWeight: 600,
                color: C.textStrong,
                marginTop: 10,
              }}
            >
              {row.covered ? 'R$ 0' : fmtBRLShort(row.missing)}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.text2, marginTop: 6 }}>
              {t.detail.missingSub}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn-shine"
          onClick={() => router.push('/family/deposito')}
          style={{
            width: '100%',
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 600,
            color: C.chromeInk,
            background: C.chromeSoft,
            border: 'none',
            borderRadius: 12,
            padding: 15,
            cursor: 'pointer',
            marginTop: 16,
            boxShadow: '0 1px 0 rgba(255,255,255,.5) inset,0 8px 22px rgba(0,0,0,.4)',
          }}
        >
          {t.detail.cta}
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
          {t.detail.note(`${rate}%`)}
        </div>
      </main>
    </div>
  );
}
