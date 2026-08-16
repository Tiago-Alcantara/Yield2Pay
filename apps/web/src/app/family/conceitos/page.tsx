'use client';

/**
 * "Entenda como funciona" — /family/conceitos
 *
 * Três conceitos em acordeão (carteira, moeda estável, rendimento) + FAQ.
 * Cada conceito responde sempre as mesmas três perguntas: o que é, por que é
 * bom pra você, e o que você faz na prática.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { C, eyebrow } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { BackHeader, NumberTile } from '../_components/FamilyUI';

export default function FamilyConceptsPage() {
  const { t } = useFamily();
  const [open, setOpen] = useState<string | null>(null);

  const blockLabel: React.CSSProperties = {
    fontFamily: C.mono,
    fontSize: 11,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    color: C.text3,
  };
  const blockBody: React.CSSProperties = {
    fontSize: 14.5,
    lineHeight: 1.65,
    color: C.textSoft,
    margin: '6px 0 0',
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bgRadial }}>
      <BackHeader label={t.concepts.back} />

      <main
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: 'clamp(40px,6vw,64px) 24px 72px',
        }}
      >
        <div style={eyebrow()}>{t.concepts.eyebrow}</div>
        <h1
          style={{
            fontSize: 'clamp(30px,4vw,42px)',
            fontWeight: 700,
            letterSpacing: '-.025em',
            lineHeight: 1.1,
            margin: '14px 0 0',
            color: C.textStrong,
            textWrap: 'balance',
          }}
        >
          {t.concepts.title}
        </h1>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: C.text2,
            margin: '14px 0 0',
            maxWidth: 520,
          }}
        >
          {t.concepts.sub}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 32 }}>
          {t.concepts.items.map((item) => {
            const isOpen = open === item.id;
            return (
              <div
                key={item.id}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 18,
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: 'none',
                    border: 'none',
                    padding: '20px 22px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <NumberTile size={42}>{item.n}</NumberTile>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 18,
                        fontWeight: 700,
                        color: C.textStrong,
                        letterSpacing: '-.01em',
                      }}
                    >
                      {item.title}
                    </span>
                    <span style={{ display: 'block', fontSize: 13.5, color: C.text2, marginTop: 3 }}>
                      {item.sub}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      color: C.text3,
                      fontSize: 18,
                      flexShrink: 0,
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform .25s ease',
                    }}
                  >
                    ⌄
                  </span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: '2px 22px 22px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={blockLabel}>{t.concepts.what}</div>
                      <p style={blockBody}>{item.what}</p>
                    </div>
                    <div>
                      <div style={blockLabel}>{t.concepts.why}</div>
                      <p style={blockBody}>{item.why}</p>
                    </div>
                    <div>
                      <div style={blockLabel}>{t.concepts.how}</div>
                      <p style={blockBody}>{item.how}</p>
                    </div>
                    <Link
                      href="/family/dashboard"
                      style={{ fontSize: 13.5, fontWeight: 600, color: C.silver }}
                    >
                      {t.concepts.answered}
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 48 }}>
          <div style={eyebrow()}>{t.concepts.faqTitle}</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
            {t.concepts.faq.map((item, i) => (
              <div
                key={item.q}
                style={{
                  borderBottom:
                    i === t.concepts.faq.length - 1 ? 'none' : `1px solid ${C.borderFaint}`,
                  padding: '18px 0',
                }}
              >
                <div style={{ fontSize: 15.5, fontWeight: 600, color: C.textStrong }}>{item.q}</div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: C.text2, margin: '6px 0 0' }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/family/dashboard"
          className="fam-outline"
          style={{
            display: 'block',
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 600,
            color: C.textStrong,
            background: 'rgba(255,255,255,.03)',
            border: `1px solid ${C.borderMetal}`,
            borderRadius: 12,
            padding: 14,
            marginTop: 36,
            textDecoration: 'none',
            transition: 'border-color .2s ease',
          }}
        >
          {t.concepts.backCta}
        </Link>
        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.5,
            color: C.text4,
            textAlign: 'center',
            marginTop: 14,
          }}
        >
          {t.concepts.note}
        </div>
      </main>
    </div>
  );
}
