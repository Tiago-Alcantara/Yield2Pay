'use client';

/**
 * Landing "Yield2Pay para famílias" — /family
 *
 * Reproduz design/nemPages/Yield2Pay Famílias.dc.html (PT) e
 * Yield2Pay Families EN.dc.html (EN), com o seletor de idioma no cabeçalho
 * como nas demais páginas públicas do sistema.
 *
 * A calculadora é local: nada vai para o servidor. O formulário de lista de
 * espera valida o e-mail e mostra o estado "enviado" — a integração real entra
 * junto com o backend.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  C,
  CHROME_SHADOW,
  PANEL_SHADOW_LG,
  cardLabel,
  eyebrow,
} from './_lib/familyTheme';
import { FAM, type FamilyLang } from './_lib/familyI18n';
import { useFamily } from './_lib/FamilyProvider';
import {
  fmtBRL,
  fmtBRLShort,
  isValidEmail,
  numericOnly,
  parseBRL,
} from './_lib/familyFormat';
import {
  coveredAmount,
  depositForMonthly,
  freedomPercent,
  monthlyYieldOf,
} from './_lib/familyMath';
import {
  BrandDiamond,
  CoverageBar,
  FamilyBrand,
  MetalPanel,
  NumberTile,
  PillGroup,
} from './_components/FamilyUI';

const SCENARIOS = [6, 8, 10];
const DEFAULT_PICKED = ['netflix', 'spotify', 'ingles'];
const DEFAULT_DEPOSIT = 60000;
/** Valor ilustrativo do card do hero (design: R$ 284,70 cobertos no mês). */
const HERO_COVERED = 284.7;

export default function FamilyLandingPage() {
  const { lang, setLang } = useFamily();
  const t = FAM[lang].landing;

  const [picked, setPicked] = useState<string[]>(DEFAULT_PICKED);
  const [extra, setExtra] = useState('');
  const [deposit, setDeposit] = useState(DEFAULT_DEPOSIT);
  const [rate, setRate] = useState(8);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [sent, setSent] = useState(false);

  const calc = useMemo(() => {
    const monthly =
      t.subs.reduce((sum, s) => sum + (picked.includes(s.id) ? s.price : 0), 0) + parseBRL(extra);
    const yieldPerMonth = monthlyYieldOf(deposit, rate);
    return {
      monthly,
      yieldPerMonth,
      covered: coveredAmount(monthly, yieldPerMonth),
      pct: freedomPercent(monthly, yieldPerMonth),
      needed: depositForMonthly(monthly, rate),
    };
  }, [t.subs, picked, extra, deposit, rate]);

  const freedomLine =
    calc.monthly === 0 ? t.freedomEmpty : calc.pct >= 100 ? t.freedomFull : t.freedomPartial;

  function toggleSub(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = isValidEmail(email);
    setEmailError(!ok);
    setSent(ok);
  }

  const sectionStyle: React.CSSProperties = {
    maxWidth: 1200,
    margin: '0 auto',
    padding: 'clamp(48px,7vw,88px) var(--fam-gutter)',
    borderTop: `1px solid ${C.border}`,
  };
  const h2Style: React.CSSProperties = {
    fontSize: 'clamp(25px,5.4vw,40px)',
    fontWeight: 700,
    letterSpacing: '-.025em',
    lineHeight: 1.1,
    margin: '14px 0 0',
    maxWidth: 640,
    textWrap: 'balance',
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'rgba(12,13,15,.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '14px var(--fam-gutter)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <FamilyBrand tag={FAM[lang].brandTag} href="#topo" />
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(12px,2.4vw,22px)',
              flexWrap: 'wrap',
            }}
          >
            {/* No celular as âncoras somem: a página é curta e as seções ficam
                a uma rolagem de distância. */}
            <a
              href="#calculadora"
              className="fam-quiet fam-hide-sm"
              style={{ fontSize: 14.5, color: C.text2 }}
            >
              {t.navCalc}
            </a>
            <a
              href="#como-funciona"
              className="fam-quiet fam-hide-sm"
              style={{ fontSize: 14.5, color: C.text2 }}
            >
              {t.navHow}
            </a>
            <PillGroup
              ariaLabel={FAM[lang].langLabel}
              options={[
                { value: 'pt', label: 'PT' },
                { value: 'en', label: 'EN' },
              ]}
              value={lang}
              onChange={(v) => setLang(v as FamilyLang)}
              mono
            />
            <a
              href="#comecar"
              className="btn-shine"
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: C.chromeInk,
                background: C.chromeSoft,
                borderRadius: 12,
                padding: '11px clamp(14px,3vw,20px)',
                boxShadow: CHROME_SHADOW,
              }}
            >
              {t.navCta}
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        id="topo"
        className="fam-hero"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 'clamp(44px,9vw,104px) var(--fam-gutter) clamp(40px,6vw,72px)',
        }}
      >
        <div>
          <div style={eyebrow()}>{t.heroEyebrow}</div>
          <h1
            style={{
              fontSize: 'clamp(31px,7.4vw,62px)',
              fontWeight: 700,
              letterSpacing: '-.03em',
              lineHeight: 1.04,
              margin: '22px 0 0',
              maxWidth: 600,
              textWrap: 'balance',
            }}
          >
            {t.heroTitle}
          </h1>
          <p
            style={{
              fontSize: 'clamp(16px,1.5vw,19px)',
              lineHeight: 1.6,
              color: C.text2,
              margin: '24px 0 0',
              maxWidth: 500,
            }}
          >
            {t.heroSub}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
            <a
              href="#comecar"
              className="btn-shine"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: C.chromeInk,
                background: C.chromeSoft,
                borderRadius: 12,
                padding: '14px 24px',
                boxShadow: CHROME_SHADOW,
              }}
            >
              {t.heroCta1}
            </a>
            <a
              href="#calculadora"
              className="fam-outline"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: C.textStrong,
                background: 'rgba(255,255,255,.03)',
                border: `1px solid ${C.borderMetal}`,
                borderRadius: 12,
                padding: '14px 24px',
                boxShadow: '0 1px 0 rgba(255,255,255,.08) inset',
              }}
            >
              {t.heroCta2}
            </a>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 30 }}>
            {t.heroSeals.map((seal) => (
              <span
                key={seal}
                style={{
                  fontFamily: C.mono,
                  fontSize: 12,
                  letterSpacing: '.04em',
                  color: C.silver,
                }}
              >
                ◆ {seal}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <MetalPanel
            radius={24}
            shadow={'0 30px 70px rgba(0,0,0,.6),0 2px 0 rgba(255,255,255,.12) inset'}
            style={{ width: '100%', maxWidth: 360 }}
          >
            <div style={{ ...cardLabel, letterSpacing: '.16em', color: C.text2 }}>
              {t.heroCardLabel}
            </div>
            <div
              style={{
                fontFamily: C.mono,
                fontSize: 'clamp(28px,8vw,34px)',
                fontWeight: 600,
                color: C.textStrong,
                marginTop: 16,
                letterSpacing: '.01em',
                textShadow: '0 1px 0 rgba(0,0,0,.4)',
              }}
            >
              {fmtBRL(HERO_COVERED)}
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: C.text2, marginTop: 8 }}>
              {t.heroCardSub}
            </div>
            <div style={{ marginTop: 20 }}>
              <CoverageBar percent={100} height={6} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
              {t.heroCardRows.map((row, i) => (
                <div
                  key={row}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 0',
                    borderBottom:
                      i === t.heroCardRows.length - 1 ? 'none' : `1px solid ${C.borderHairline}`,
                  }}
                >
                  <span style={{ fontSize: 14, color: C.text }}>{row}</span>
                  <span style={{ fontFamily: C.mono, fontSize: 13, color: C.silver }}>
                    {t.heroCardPaid}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                ...cardLabel,
                letterSpacing: '.14em',
                marginTop: 18,
              }}
            >
              {t.heroCardNote}
            </div>
          </MetalPanel>
        </div>
      </section>

      {/* ── Calculadora ───────────────────────────────────────────────────── */}
      <section id="calculadora" style={sectionStyle}>
        <div style={eyebrow()}>{t.calcEyebrow}</div>
        <h2 style={h2Style}>{t.calcTitle}</h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: C.text2, margin: '14px 0 0', maxWidth: 540 }}>
          {t.calcSub}
        </p>

        <div className="fam-calc-grid" style={{ marginTop: 32 }}>
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              padding: 'var(--fam-card-pad)',
            }}
          >
            <div style={{ ...cardLabel, color: C.text2 }}>{t.calcSubsLabel}</div>
            <div className="fam-subs-grid" style={{ marginTop: 16 }}>
              {t.subs.map((s) => {
                const on = picked.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSub(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      fontWeight: on ? 600 : 500,
                      color: on ? C.textStrong : C.text2,
                      background: on ? 'rgba(192,194,197,.08)' : C.well,
                      border: `1px solid ${on ? C.silver : C.border}`,
                      borderRadius: 12,
                      padding: '12px 14px',
                      transition: 'all .2s ease',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 10,
                        height: 10,
                        flexShrink: 0,
                        borderRadius: 3,
                        background: on ? C.chromeSoft : C.border,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>{s.name}</span>
                    <span style={{ fontFamily: C.mono, fontSize: 12.5, color: C.silver }}>
                      {fmtBRLShort(s.price)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 22, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
              <label
                htmlFor="fam-outras"
                style={{ ...cardLabel, display: 'block', marginBottom: 8 }}
              >
                {t.calcExtraLabel}
              </label>
              <input
                id="fam-outras"
                className="fam-field"
                type="text"
                inputMode="numeric"
                value={extra}
                onChange={(e) => setExtra(numericOnly(e.target.value))}
                placeholder="0"
                style={{
                  width: '100%',
                  background: C.well,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '13px 14px',
                  color: C.textStrong,
                  fontFamily: C.mono,
                  fontSize: 15,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginTop: 22, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={cardLabel}>{t.calcDepositLabel}</span>
                <span
                  style={{
                    fontFamily: C.mono,
                    fontSize: 16,
                    fontWeight: 600,
                    color: C.textStrong,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fmtBRLShort(deposit)}
                </span>
              </div>
              <input
                className="fam-range"
                type="range"
                min={0}
                max={200000}
                step={1000}
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
                aria-label={t.calcDepositAria}
                style={{ marginTop: 14 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontFamily: C.mono, fontSize: 11, color: C.text4 }}>R$ 0</span>
                <span style={{ fontFamily: C.mono, fontSize: 11, color: C.text4 }}>R$ 200.000</span>
              </div>
            </div>

            <div
              style={{
                marginTop: 22,
                paddingTop: 20,
                borderTop: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <span style={cardLabel}>{t.calcScenarioLabel}</span>
              <PillGroup
                ariaLabel={t.calcScenarioLabel}
                options={SCENARIOS.map((r) => ({
                  value: String(r),
                  label: `${r}${t.calcScenarioSuffix}`,
                }))}
                value={String(rate)}
                onChange={(v) => setRate(Number(v))}
                mono
              />
            </div>
          </div>

          <MetalPanel radius={20}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ ...cardLabel, letterSpacing: '.16em', color: C.text2 }}>
                {t.freedomLabel}
              </div>
              <div
                style={{
                  fontFamily: C.mono,
                  fontSize: 'clamp(42px,13vw,56px)',
                  fontWeight: 600,
                  color: C.textStrong,
                  marginTop: 12,
                  letterSpacing: '-.01em',
                  lineHeight: 1,
                  textShadow: '0 1px 0 rgba(0,0,0,.4)',
                }}
              >
                {calc.pct}%
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5, color: C.textSoft, marginTop: 10 }}>
                {freedomLine}
              </div>
              <div style={{ marginTop: 18 }}>
                <CoverageBar percent={calc.pct} />
              </div>

              <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column' }}>
                {[
                  { label: t.rowMonthly, value: fmtBRL(calc.monthly), strong: true },
                  { label: t.rowCovered, value: fmtBRL(calc.covered), strong: true },
                  { label: t.rowNeeded, value: fmtBRLShort(calc.needed), strong: false },
                ].map((row, i) => (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 0',
                      borderBottom: i === 2 ? 'none' : `1px solid ${C.borderHairline}`,
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: C.text2 }}>{row.label}</span>
                    <span
                      style={{
                        fontFamily: C.mono,
                        fontSize: 15,
                        color: row.strong ? C.textStrong : C.silverBright,
                      }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <a
                href="#comecar"
                className="btn-shine"
                style={{
                  marginTop: 'auto',
                  textAlign: 'center',
                  fontSize: 15,
                  fontWeight: 600,
                  color: C.chromeInk,
                  background: C.chromeSoft,
                  borderRadius: 12,
                  padding: '14px 22px',
                  boxShadow: CHROME_SHADOW,
                }}
              >
                {t.calcCta}
              </a>
              <div
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: C.text4,
                  textAlign: 'center',
                  marginTop: 10,
                }}
              >
                {t.calcNote}
              </div>
            </div>
          </MetalPanel>
        </div>
      </section>

      {/* ── Como funciona ─────────────────────────────────────────────────── */}
      <section id="como-funciona" style={sectionStyle}>
        <div style={eyebrow()}>{t.howEyebrow}</div>
        <h2 style={{ ...h2Style, maxWidth: 620 }}>{t.howTitle}</h2>
        <div className="fam-cards-3" style={{ marginTop: 28 }}>
          {t.howSteps.map((step) => (
            <div
              key={step.n}
              className="fam-card-hover"
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 18,
                padding: 'var(--fam-card-pad)',
              }}
            >
              <NumberTile>{step.n}</NumberTile>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: C.textStrong,
                  marginTop: 18,
                  letterSpacing: '-.01em',
                }}
              >
                {step.title}
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: C.text2, margin: '10px 0 0' }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── O que está por trás ───────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <div style={eyebrow()}>{t.behindEyebrow}</div>
        <h2 style={{ ...h2Style, maxWidth: 620 }}>{t.behindTitle}</h2>
        <div className="fam-cards-3" style={{ marginTop: 28 }}>
          {t.behindCards.map((card) => (
            <MetalPanel key={card.kicker} radius={20}>
              <div style={{ ...cardLabel, letterSpacing: '.16em', color: C.text2 }}>
                {card.kicker}
              </div>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 700,
                  color: C.textStrong,
                  marginTop: 14,
                  textShadow: '0 1px 0 rgba(0,0,0,.4)',
                }}
              >
                {card.title}
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: C.textSoft, margin: '10px 0 0' }}>
                {card.desc}
              </p>
            </MetalPanel>
          ))}
        </div>
      </section>

      {/* ── Lista de espera ───────────────────────────────────────────────── */}
      <section
        id="comecar"
        style={{ ...sectionStyle, paddingBottom: 'clamp(72px,8vw,104px)' }}
      >
        <MetalPanel radius={26} padding={0} shadow={PANEL_SHADOW_LG}>
          <div
            style={{
              padding: 'clamp(22px,4.5vw,52px)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 32,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ flex: '1 1 380px' }}>
              <h2
                style={{
                  fontSize: 'clamp(23px,4.6vw,36px)',
                  fontWeight: 700,
                  letterSpacing: '-.025em',
                  lineHeight: 1.1,
                  margin: 0,
                  maxWidth: 460,
                  textShadow: '0 1px 0 rgba(0,0,0,.4)',
                  textWrap: 'balance',
                }}
              >
                {t.ctaTitle}
              </h2>
              <p
                style={{
                  fontSize: 15.5,
                  lineHeight: 1.6,
                  color: C.textSoft,
                  margin: '14px 0 0',
                  maxWidth: 420,
                }}
              >
                {t.ctaSub}
              </p>
            </div>
            <div style={{ flex: '0 1 380px', minWidth: 'min(280px,100%)' }}>
              <form
                onSubmit={handleSubmit}
                noValidate
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <label htmlFor="fam-email" style={cardLabel}>
                  {t.emailLabel}
                </label>
                <input
                  id="fam-email"
                  className="fam-field"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(false);
                  }}
                  placeholder={t.emailPlaceholder}
                  autoComplete="email"
                  aria-invalid={emailError}
                  style={{
                    width: '100%',
                    background: C.well,
                    border: `1px solid ${emailError ? C.inputError : C.border}`,
                    borderRadius: 12,
                    padding: '13px 14px',
                    color: C.textStrong,
                    fontFamily: C.mono,
                    fontSize: 15,
                    outline: 'none',
                    transition: 'border-color .2s ease',
                  }}
                />
                {emailError && (
                  <div role="alert" style={{ fontSize: 12.5, color: C.danger }}>
                    {t.emailError}
                  </div>
                )}
                <button
                  type="submit"
                  className="btn-shine"
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 15,
                    fontWeight: 600,
                    color: C.chromeInk,
                    background: C.chromeSoft,
                    border: 'none',
                    borderRadius: 12,
                    padding: 15,
                    cursor: 'pointer',
                    minHeight: 50,
                    boxShadow: CHROME_SHADOW,
                  }}
                >
                  {sent ? t.submitSent : t.submitIdle}
                </button>
                <div
                  style={{
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    color: C.text4,
                    textAlign: 'center',
                  }}
                >
                  {t.ctaNote}
                </div>
              </form>
            </div>
          </div>
        </MetalPanel>
      </section>

      {/* ── Rodapé ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${C.border}` }}>
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '28px var(--fam-gutter)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 20,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandDiamond size={11} glow={false} />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: C.text }}>
              Yield2Pay
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              color: C.text4,
              margin: 0,
              maxWidth: 620,
            }}
          >
            {t.footerNote}
          </p>
          <span
            style={{
              fontFamily: C.mono,
              fontSize: 11,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: C.text4,
            }}
          >
            {t.copyright}
          </span>
        </div>
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 var(--fam-gutter) 28px',
          }}
        >
          <Link
            href="/family/onboarding"
            className="fam-quiet"
            style={{ fontSize: 13, color: C.text3, textDecoration: 'none' }}
          >
            {t.enterApp}
          </Link>
        </div>
      </footer>
    </div>
  );
}
