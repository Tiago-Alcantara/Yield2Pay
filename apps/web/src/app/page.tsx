'use client';

/**
 * Yield2Pay Landing Page — page.tsx
 *
 * Faithfully reproduces design/reference/Yield2Pay.dc.html verbatim in JSX:
 *   - Header nav (How it works / Services / Why Yield2Pay) + EN/PT toggle
 *   - Hero section with h-title clamp typography + looping .sweep animation
 *   - How it works steps section
 *   - Why Yield2Pay benefits section
 *   - Software logos marquee section
 *   - Trust / security banner
 *   - Final CTA section
 *   - Footer with language toggle + social icons
 *
 * Behavioral changes from reference:
 *   - CTA ("Get started") routes to /login via next/navigation useRouter
 *   - Lang toggle via React useState (instead of DCLogic setState)
 *   - IntersectionObserver scroll-reveal via useEffect
 *   - 3D tilt on cards via useEffect (pointer:fine + prefers-reduced-motion guard)
 *   - Header scroll effect via useEffect + scroll listener
 */

import React, { useState, useEffect, useRef, useCallback, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '@/lib/useIsMobile';

// ── Types ──────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'pt';

// ── Dictionary (exact copy from reference renderVals()) ───────────────────────

const DICT = {
  en: {
    navHow: 'How it works',
    navServices: 'Services',
    navWhy: 'Why Yield2Pay',
    login: 'Log in',
    getStarted: 'Get started',
    heroTagline: 'Banking, reinvented for software',
    heroTitle: 'Your capital pays for your software. You spend nothing.',
    heroSub:
      'Deposit once. We put your capital to work, and the returns cover your AI and SaaS subscriptions — automatically. Your money stays yours.',
    heroCta1: 'Get started',
    heroCta2: 'See how it works',
    cardLabel: 'Capital working',
    cardBalance: '$18,400.00',
    cardReturns: '$214.80',
    cardStatus: 'Active',
    cardYield: '+8.4% / yr',
    cardReturnsLabel: 'Returns / month',
    cardCoveredLabel: 'Covered',
    cardCovered: '7 tools',
    howTitle: 'How it works',
    howSub: 'Three simple steps to put your capital to work.',
    steps: [
      { n: '01', title: 'Make your deposit', desc: 'Deposit between $1,000 and $20,000 via secure transfer.' },
      { n: '02', title: 'We invest your capital', desc: 'Your capital is allocated to generate steady, transparent returns.' },
      { n: '03', title: 'Your software gets paid', desc: 'The returns automatically cover the subscriptions you choose.' },
    ],
    benTitle: 'Why businesses choose Yield2Pay',
    benSub: 'Built to keep your tools running without ever touching your cash flow.',
    benefits: [
      { title: 'No cost out of pocket', desc: 'Your subscriptions are paid by returns, not your cash flow.' },
      { title: 'Cancel anytime', desc: 'Withdraw your capital whenever you need it.' },
      { title: 'Real-time tracking', desc: 'See your returns and active services on one dashboard.' },
      { title: 'Your capital stays yours', desc: 'You own your deposit at all times. We just put it to work.' },
    ],
    swTitle: 'Pay for the tools you already use',
    swSub: 'Your returns cover the subscriptions your team relies on.',
    swNote: 'Example integrations',
    trustTitle: 'Security you can rely on',
    trust: [
      { title: 'Capital protected' },
      { title: 'Full transparency' },
      { title: 'Blockchain-powered' },
      { title: 'Withdraw anytime' },
    ],
    finalTitle: 'Put your idle capital to work',
    finalSub: 'Open an account in minutes. Your capital stays yours — your tools stay paid.',
    finalCta: 'Get started',
    footProduct: 'Product',
    footCompany: 'Company',
    footLegal: 'Legal',
    footProductLinks: ['How it works', 'Services', 'Security'],
    footCompanyLinks: ['About', 'Contact', 'Careers'],
    footLegalLinks: ['Terms', 'Privacy'],
    footTagline: 'The bank that pays your software.',
    copyright: '© 2026 Yield2Pay. All rights reserved.',
  },
  pt: {
    navHow: 'Como funciona',
    navServices: 'Serviços',
    navWhy: 'Por que Yield2Pay',
    login: 'Entrar',
    getStarted: 'Começar',
    heroTagline: 'O banco que paga seus softwares',
    heroTitle: 'Seu capital paga seus softwares. Você não gasta nada.',
    heroSub:
      'Deposite uma vez. Colocamos seu capital para trabalhar, e o rendimento cobre suas assinaturas de IA e SaaS — automaticamente. Seu dinheiro continua seu.',
    heroCta1: 'Começar agora',
    heroCta2: 'Veja como funciona',
    cardLabel: 'Capital rendendo',
    cardBalance: 'R$ 92.000,00',
    cardReturns: 'R$ 1.074',
    cardStatus: 'Ativo',
    cardYield: '+8,4% / ano',
    cardReturnsLabel: 'Rendimento / mês',
    cardCoveredLabel: 'Cobertas',
    cardCovered: '7 ferramentas',
    howTitle: 'Como funciona',
    howSub: 'Três passos simples para colocar seu capital para trabalhar.',
    steps: [
      { n: '01', title: 'Faça seu aporte', desc: 'Deposite entre R$5.000 e R$20.000 por transferência segura.' },
      { n: '02', title: 'Investimos seu capital', desc: 'Seu capital é alocado para gerar rendimento estável e transparente.' },
      { n: '03', title: 'Seus softwares são pagos', desc: 'O rendimento cobre automaticamente as assinaturas que você escolher.' },
    ],
    benTitle: 'Por que empresas escolhem o Yield2Pay',
    benSub: 'Feito para manter suas ferramentas no ar sem nunca tocar no seu caixa.',
    benefits: [
      { title: 'Sem custo do seu bolso', desc: 'Suas assinaturas são pagas pelo rendimento, não pelo seu caixa.' },
      { title: 'Cancele quando quiser', desc: 'Resgate seu capital quando precisar.' },
      { title: 'Acompanhe em tempo real', desc: 'Veja seu rendimento e serviços ativos em um só painel.' },
      { title: 'Seu capital continua seu', desc: 'O aporte é sempre seu. Nós só o colocamos para trabalhar.' },
    ],
    swTitle: 'Pague pelas ferramentas que você já usa',
    swSub: 'Seu rendimento cobre as assinaturas que seu time já usa.',
    swNote: 'Integrações de exemplo',
    trustTitle: 'Segurança em que você pode confiar',
    trust: [
      { title: 'Capital protegido' },
      { title: 'Transparência total' },
      { title: 'Tecnologia blockchain' },
      { title: 'Resgate quando quiser' },
    ],
    finalTitle: 'Coloque seu capital parado para trabalhar',
    finalSub: 'Abra sua conta em minutos. Seu capital continua seu — suas ferramentas continuam pagas.',
    finalCta: 'Começar agora',
    footProduct: 'Produto',
    footCompany: 'Empresa',
    footLegal: 'Legal',
    footProductLinks: ['Como funciona', 'Serviços', 'Segurança'],
    footCompanyLinks: ['Sobre', 'Contato', 'Carreiras'],
    footLegalLinks: ['Termos', 'Privacidade'],
    footTagline: 'O banco que paga seus softwares.',
    copyright: '© 2026 Yield2Pay. Todos os direitos reservados.',
  },
} as const;

// ── Software logos (doubled for seamless marquee loop) ────────────────────────

const SW_LOGOS = ['OpenAI', 'Anthropic', 'Notion', 'Figma', 'GitHub', 'Linear', 'Slack'];
const SW_LOGOS_LOOP = [...SW_LOGOS, ...SW_LOGOS];

// ── SVG icons (matching reference icons() method exactly) ─────────────────────

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const Icons = {
  deposit: (
    <Svg>
      <path d="M12 4v9" />
      <path d="M8.5 9.5l3.5 3.5 3.5-3.5" />
      <path d="M5 20h14" />
    </Svg>
  ),
  invest: (
    <Svg>
      <path d="M4 19h16" />
      <path d="M6 15l4-4 3 2.5 5-6.5" />
      <path d="M18 6h-2.5" />
      <path d="M18 6v2.5" />
    </Svg>
  ),
  pay: (
    <Svg>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M8.5 12l2.3 2.3 4.7-5" />
    </Svg>
  ),
  wallet: (
    <Svg>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H18a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5z" />
      <path d="M16 12.5h2" />
      <path d="M4 9V6.5A1.5 1.5 0 0 1 5.5 5H15" />
    </Svg>
  ),
  refresh: (
    <Svg>
      <path d="M19 8a7 7 0 0 0-12-1.5" />
      <path d="M19 4v4h-4" />
      <path d="M5 16a7 7 0 0 0 12 1.5" />
      <path d="M5 20v-4h4" />
    </Svg>
  ),
  activity: (
    <Svg>
      <path d="M3 12h4l2.5 6 5-12 2.5 6h4" />
    </Svg>
  ),
  shield: (
    <Svg>
      <path d="M12 3.5l7 2.6v5.4c0 4-3 6.7-7 7.9-4-1.2-7-3.9-7-7.9V6.1z" />
      <path d="M9 12l2 2 4-4.5" />
    </Svg>
  ),
  lock: (
    <Svg>
      <path d="M6.5 10.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </Svg>
  ),
  eye: (
    <Svg>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx={12} cy={12} r={2.6} />
    </Svg>
  ),
  cube: (
    <Svg>
      <path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z" />
      <path d="M12 3.5v17" />
      <path d="M4.5 7.7L12 12l7.5-4.3" />
    </Svg>
  ),
  clock: (
    <Svg>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  ),
};

const STEP_ICONS = [Icons.deposit, Icons.invest, Icons.pay];
const BEN_ICONS = [Icons.wallet, Icons.refresh, Icons.activity, Icons.shield];
const TRUST_ICONS = [Icons.lock, Icons.eye, Icons.cube, Icons.clock];

// ── Tab style helpers ─────────────────────────────────────────────────────────

const TAB_BASE: CSSProperties = {
  border: 'none',
  borderRadius: '999px',
  padding: '5px 12px',
  fontSize: '12.5px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '.03em',
};
const TAB_ACTIVE: CSSProperties = { background: '#2E3136', color: '#F2F3F4' };
const TAB_IDLE: CSSProperties = { background: 'transparent', color: '#9A9DA1' };

// ── Primary CTA button style ──────────────────────────────────────────────────

const CTA_BTN: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '14px',
  fontWeight: 600,
  color: '#0E0F11',
  background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)',
  border: 'none',
  borderRadius: '999px',
  padding: '10px 18px',
  cursor: 'pointer',
  transition: 'transform .25s ease,box-shadow .25s ease,filter .25s ease',
  boxShadow: '0 1px 0 rgba(255,255,255,.5) inset,0 6px 18px rgba(0,0,0,.35)',
};

// ── LangToggle component ──────────────────────────────────────────────────────

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const isEn = lang === 'en';
  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: 'inline-flex',
        border: '1px solid #2A2D31',
        borderRadius: '999px',
        padding: '3px',
        gap: '2px',
        background: '#16181B',
      }}
    >
      <button
        onClick={() => setLang('en')}
        aria-pressed={isEn}
        style={{ ...TAB_BASE, ...(isEn ? TAB_ACTIVE : TAB_IDLE) }}
      >
        EN
      </button>
      <button
        onClick={() => setLang('pt')}
        aria-pressed={!isEn}
        style={{ ...TAB_BASE, ...(!isEn ? TAB_ACTIVE : TAB_IDLE) }}
      >
        PT
      </button>
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('pt');
  const headerRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();

  const t = DICT[lang];
  const isEn = lang === 'en';

  const goLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

  // ── Header scroll effect ──────────────────────────────────────────────────
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const onScroll = () => {
      if (window.scrollY > 8) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── anim-done: lock hero entrance elements visible after 1700ms ───────────
  useEffect(() => {
    const timer = setTimeout(() => {
      document.documentElement.classList.add('anim-done');
    }, 1700);
    return () => {
      clearTimeout(timer);
      document.documentElement.classList.remove('anim-done');
    };
  }, []);

  // ── IntersectionObserver scroll reveal ───────────────────────────────────
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0, rootMargin: '200px 0px 200px 0px' }
    );
    requestAnimationFrame(() => {
      document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    });
    return () => io.disconnect();
  }, []);

  // ── 3D tilt on cards (pointer:fine + prefers-reduced-motion guard) ────────
  useEffect(() => {
    const fine = window.matchMedia('(pointer:fine)').matches;
    const motionOk = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    if (!fine || !motionOk) return;

    const cleanups: (() => void)[] = [];
    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('.tilt').forEach((el) => {
        const orig = el.style.transition;
        const move = (ev: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const dx = (ev.clientX - r.left) / r.width - 0.5;
          const dy = (ev.clientY - r.top) / r.height - 0.5;
          el.style.transform = `perspective(900px) rotateX(${(-dy * 5).toFixed(2)}deg) rotateY(${(dx * 5).toFixed(2)}deg) translateY(-4px)`;
        };
        const enter = () => { el.style.transition = 'transform .08s ease-out'; };
        const leave = () => { el.style.transition = orig; el.style.transform = ''; };
        el.addEventListener('pointerenter', enter);
        el.addEventListener('pointermove', move as EventListener);
        el.addEventListener('pointerleave', leave);
        cleanups.push(() => {
          el.removeEventListener('pointerenter', enter);
          el.removeEventListener('pointermove', move as EventListener);
          el.removeEventListener('pointerleave', leave);
        });
      });
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  // ── Hero title words ──────────────────────────────────────────────────────
  const heroWords = t.heroTitle.split(' ');

  return (
    <div style={{ position: 'relative' }}>

      {/* ── Global landing-page styles injected via style tag ─────────────── */}
      <style>{`
        .header.scrolled {
          background: rgba(12,13,15,.74) !important;
          backdrop-filter: blur(16px) saturate(160%);
          -webkit-backdrop-filter: blur(16px) saturate(160%);
          border-color: #26292e !important;
        }
        @keyframes fadeUp { from { opacity: 0; } to { opacity: 1; } }
        @keyframes wordIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ctaIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cardIn3D {
          from { opacity: 0; transform: perspective(1300px) rotateX(8deg) rotateY(-14deg) scale(.95); }
          to   { opacity: 1; transform: perspective(1300px) rotateX(0deg) rotateY(0deg) scale(1); }
        }
        @keyframes btnGlow {
          0%   { box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 8px 24px rgba(0,0,0,.4); }
          42%  { box-shadow: 0 0 0 5px rgba(192,194,197,.16), 0 0 30px rgba(192,194,197,.34), 0 1px 0 rgba(255,255,255,.5) inset, 0 8px 24px rgba(0,0,0,.4); }
          100% { box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 8px 24px rgba(0,0,0,.4); }
        }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee-track { animation: marquee 36s linear infinite; }
        .marquee:hover .marquee-track { animation-play-state: paused; }
        .reveal { opacity: 1; }
        .h-word { display: inline-block; }
        @media (prefers-reduced-motion: no-preference) {
          .reveal.is-in { animation: revealIn .85s ease both; }
          .stagger > .reveal:nth-child(2).is-in { animation-delay: .09s; }
          .stagger > .reveal:nth-child(3).is-in { animation-delay: .18s; }
          .stagger > .reveal:nth-child(4).is-in { animation-delay: .27s; }
          .h-eyebrow { opacity: 0; animation: fadeUp .7s ease .1s both; }
          .h-sub { opacity: 0; animation: fadeUp .7s ease .5s both; }
          .h-cta { opacity: 0; animation: ctaIn .7s ease .66s both; }
          .h-card { opacity: 0; animation: cardIn3D 1s cubic-bezier(.2,.7,.25,1) .46s both, floaty 7s ease-in-out 1.7s infinite; }
          .h-cta-primary { animation: btnGlow 1.7s ease-out 1.05s 1; }
          .h-title .h-word { opacity: 0; animation: wordIn .55s ease both; }
          .h-title .h-word:nth-child(1)  { animation-delay: .18s; }
          .h-title .h-word:nth-child(2)  { animation-delay: .24s; }
          .h-title .h-word:nth-child(3)  { animation-delay: .30s; }
          .h-title .h-word:nth-child(4)  { animation-delay: .36s; }
          .h-title .h-word:nth-child(5)  { animation-delay: .42s; }
          .h-title .h-word:nth-child(6)  { animation-delay: .48s; }
          .h-title .h-word:nth-child(7)  { animation-delay: .54s; }
          .h-title .h-word:nth-child(8)  { animation-delay: .60s; }
          .h-title .h-word:nth-child(9)  { animation-delay: .66s; }
          .h-title .h-word:nth-child(10) { animation-delay: .72s; }
          .h-title .h-word:nth-child(11) { animation-delay: .78s; }
          .h-title .h-word:nth-child(12) { animation-delay: .84s; }
        }
        .anim-done .h-eyebrow,
        .anim-done .h-sub,
        .anim-done .h-cta,
        .anim-done .h-title .h-word { animation: none !important; opacity: 1 !important; }
        .anim-done .h-card { animation: floaty 7s ease-in-out infinite !important; opacity: 1 !important; }
        @media (prefers-reduced-motion: reduce) {
          .sweep, .h-card, .marquee-track, .reveal.is-in { animation: none; }
          html { scroll-behavior: auto; }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="header"
        ref={headerRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'transparent',
          borderBottom: '1px solid transparent',
          transition: 'background .35s ease,border-color .35s ease',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '15px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          {/* Logo */}
          <a
            href="#top"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: '11px',
                height: '11px',
                background: 'linear-gradient(135deg,#E6E8EA,#9A9DA1)',
                transform: 'rotate(45deg)',
                borderRadius: '2px',
                boxShadow: '0 0 12px rgba(192,194,197,.35)',
              }}
            />
            <span
              style={{
                fontSize: '19px',
                fontWeight: 700,
                letterSpacing: '-.01em',
                color: '#EDEFF1',
              }}
            >
              Yield2Pay
            </span>
          </a>

          {/* Nav — hidden on mobile to avoid overflow */}
          {!isMobile && (
          <nav
            style={{
              display: 'flex',
              gap: '28px',
              margin: '0 auto',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <a
              href="#how"
              style={{
                fontSize: '14.5px',
                color: '#9A9DA1',
                textDecoration: 'none',
                transition: 'color .2s ease',
              }}
            >
              {t.navHow}
            </a>
            <a
              href="#software"
              style={{
                fontSize: '14.5px',
                color: '#9A9DA1',
                textDecoration: 'none',
                transition: 'color .2s ease',
              }}
            >
              {t.navServices}
            </a>
            <a
              href="#why"
              style={{
                fontSize: '14.5px',
                color: '#9A9DA1',
                textDecoration: 'none',
                transition: 'color .2s ease',
              }}
            >
              {t.navWhy}
            </a>
          </nav>
          )}

          {/* Right: lang toggle + login + CTA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '10px' : '14px',
              flexShrink: 0,
            }}
          >
            <LangToggle lang={lang} setLang={setLang} />
            {!isMobile && (
              <a
                href="/login"
                style={{
                  fontSize: '14.5px',
                  color: '#9A9DA1',
                  textDecoration: 'none',
                  transition: 'color .2s ease',
                }}
              >
                {t.login}
              </a>
            )}
            <button
              onClick={goLogin}
              className="btn-shine"
              style={CTA_BTN}
            >
              {t.getStarted}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main id="top">

        {/* ── Hero section ──────────────────────────────────────────────── */}
        <section
          style={{
            position: 'relative',
            minHeight: '94vh',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            background:
              'radial-gradient(125% 78% at 50% -8%,#232629 0%,#121316 42%,#0c0d0f 70%)',
          }}
        >
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              maxWidth: '920px',
              margin: '0 auto',
              padding: '160px 24px 96px',
              textAlign: 'center',
              width: '100%',
            }}
          >
            {/* Eyebrow */}
            <div
              className="h-eyebrow"
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: '12.5px',
                fontWeight: 500,
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                color: '#9A9DA1',
              }}
            >
              {t.heroTagline}
            </div>

            {/* Title */}
            <h1
              className="h-title"
              style={{
                fontSize: 'clamp(38px,5.6vw,66px)',
                fontWeight: 700,
                lineHeight: 1.06,
                letterSpacing: '-.025em',
                margin: '22px auto 0',
                color: '#EDEFF1',
                maxWidth: '840px',
              }}
            >
              {heroWords.map((word, i) => (
                <React.Fragment key={i}>
                  <span className="h-word">{word}</span>
                  {i < heroWords.length - 1 ? ' ' : ''}
                </React.Fragment>
              ))}
            </h1>

            {/* Sub */}
            <p
              className="h-sub"
              style={{
                fontSize: 'clamp(16px,1.4vw,19px)',
                lineHeight: 1.6,
                color: '#9A9DA1',
                margin: '24px auto 0',
                maxWidth: '600px',
              }}
            >
              {t.heroSub}
            </p>

            {/* CTAs */}
            <div
              className="h-cta"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '14px',
                justifyContent: 'center',
                marginTop: '38px',
              }}
            >
              <button
                onClick={goLogin}
                className="btn-shine h-cta-primary"
                style={{
                  fontFamily: 'inherit',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#0E0F11',
                  background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '15px 30px',
                  cursor: 'pointer',
                  transition: 'transform .25s ease,box-shadow .25s ease,filter .25s ease',
                  boxShadow: '0 1px 0 rgba(255,255,255,.5) inset,0 8px 24px rgba(0,0,0,.4)',
                }}
              >
                {t.heroCta1}
              </button>
              <a
                href="#how"
                style={{
                  fontFamily: 'inherit',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: '#EDEFF1',
                  background: 'rgba(255,255,255,.025)',
                  border: '1px solid #3A3D41',
                  borderRadius: '999px',
                  padding: '15px 30px',
                  cursor: 'pointer',
                  transition: 'all .25s ease',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {t.heroCta2}
              </a>
            </div>

            {/* Hero card */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '64px',
                perspective: '1300px',
              }}
            >
              <div
                className="brushed h-card"
                style={{
                  position: 'relative',
                  width: 'min(444px,100%)',
                  borderRadius: '22px',
                  overflow: 'hidden',
                  border: '1px solid #4a4d52',
                  boxShadow: '0 44px 96px rgba(0,0,0,.62),0 2px 0 rgba(255,255,255,.12) inset',
                }}
              >
                <span className="sweep" />
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    padding: '26px 28px',
                    textAlign: 'left',
                  }}
                >
                  {/* Card header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: '11px',
                        letterSpacing: '.16em',
                        textTransform: 'uppercase',
                        color: '#9A9DA1',
                      }}
                    >
                      {t.cardLabel}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: '10.5px',
                        letterSpacing: '.12em',
                        textTransform: 'uppercase',
                        color: '#D4D6D9',
                        border: '1px solid #4a4d52',
                        borderRadius: '999px',
                        padding: '4px 11px',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#D4D6D9',
                          boxShadow: '0 0 8px rgba(212,214,217,.7)',
                        }}
                      />
                      {t.cardStatus}
                    </span>
                  </div>

                  {/* Balance */}
                  <div
                    style={{
                      marginTop: '22px',
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 'clamp(28px,4.4vw,36px)',
                      fontWeight: 600,
                      color: '#F2F3F4',
                      letterSpacing: '.01em',
                      textShadow: '0 1px 0 rgba(0,0,0,.5)',
                    }}
                  >
                    {t.cardBalance}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: '13px',
                      color: '#C0C2C5',
                      marginTop: '7px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                    }}
                  >
                    <span style={{ fontSize: '9px' }}>▲</span>
                    {t.cardYield}
                  </div>

                  {/* Sparkline SVG */}
                  <svg
                    viewBox="0 0 360 96"
                    preserveAspectRatio="none"
                    style={{
                      width: '100%',
                      height: '74px',
                      marginTop: '20px',
                      display: 'block',
                    }}
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="hArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#C0C2C5" stopOpacity=".22" />
                        <stop offset="1" stopColor="#C0C2C5" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,80 C44,74 70,50 116,54 C166,58 188,30 232,34 C278,38 312,14 360,8 L360,96 L0,96 Z"
                      fill="url(#hArea)"
                    />
                    <path
                      d="M0,80 C44,74 70,50 116,54 C166,58 188,30 232,34 C278,38 312,14 360,8"
                      fill="none"
                      stroke="#D4D6D9"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  {/* Divider */}
                  <div
                    style={{
                      height: '1px',
                      background: 'linear-gradient(90deg,transparent,#3a3d42,transparent)',
                      margin: '18px 0',
                    }}
                  />

                  {/* Card footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: '10px',
                          letterSpacing: '.12em',
                          textTransform: 'uppercase',
                          color: '#8a8d91',
                        }}
                      >
                        {t.cardReturnsLabel}
                      </div>
                      <div
                        style={{
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: '16px',
                          color: '#EDEFF1',
                          marginTop: '5px',
                        }}
                      >
                        {t.cardReturns}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: '10px',
                          letterSpacing: '.12em',
                          textTransform: 'uppercase',
                          color: '#8a8d91',
                        }}
                      >
                        {t.cardCoveredLabel}
                      </div>
                      <div
                        style={{
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: '16px',
                          color: '#EDEFF1',
                          marginTop: '5px',
                        }}
                      >
                        {t.cardCovered}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section
          id="how"
          style={{
            position: 'relative',
            padding: 'clamp(86px,11vw,128px) 0',
            background:
              'radial-gradient(90% 60% at 28% 0%,rgba(192,194,197,.05),transparent 60%)',
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
            <div className="reveal" style={{ textAlign: 'center', maxWidth: '660px', margin: '0 auto' }}>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: '12px',
                  letterSpacing: '.16em',
                  textTransform: 'uppercase',
                  color: '#C0C2C5',
                  marginBottom: '16px',
                }}
              >
                01 — 02 — 03
              </div>
              <h2
                style={{
                  fontSize: 'clamp(30px,3.4vw,40px)',
                  fontWeight: 700,
                  letterSpacing: '-.02em',
                  color: '#EDEFF1',
                  margin: 0,
                }}
              >
                {t.howTitle}
              </h2>
              <p
                style={{
                  fontSize: '18px',
                  lineHeight: 1.6,
                  color: '#9A9DA1',
                  margin: '14px 0 0',
                }}
              >
                {t.howSub}
              </p>
            </div>

            <div
              className="stagger"
              style={{
                marginTop: '58px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(264px,1fr))',
                gap: '20px',
              }}
            >
              {t.steps.map((item, i) => (
                <div
                  key={i}
                  className="reveal mcard tilt brushed"
                  style={{
                    position: 'relative',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    border: '1px solid #3a3d42',
                    boxShadow: '0 18px 44px rgba(0,0,0,.4)',
                  }}
                >
                  <span className="msheen" />
                  <div style={{ position: 'relative', zIndex: 2, padding: '30px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: '34px',
                          fontWeight: 600,
                          color: '#D4D6D9',
                          textShadow: '0 1px 0 rgba(0,0,0,.5)',
                        }}
                      >
                        {item.n}
                      </span>
                      <span style={{ color: '#C0C2C5', display: 'flex' }}>
                        {STEP_ICONS[i]}
                      </span>
                    </div>
                    <h3
                      style={{
                        fontSize: '20px',
                        fontWeight: 600,
                        color: '#EDEFF1',
                        margin: '24px 0 0',
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '15px',
                        lineHeight: 1.6,
                        color: '#9A9DA1',
                        margin: '10px 0 0',
                      }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why Yield2Pay ───────────────────────────────────────────────── */}
        <section
          id="why"
          style={{
            position: 'relative',
            padding: 'clamp(86px,11vw,128px) 0',
            background:
              'radial-gradient(90% 60% at 76% 0%,rgba(192,194,197,.05),transparent 60%)',
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
            <div
              className="reveal"
              style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto' }}
            >
              <h2
                style={{
                  fontSize: 'clamp(30px,3.4vw,40px)',
                  fontWeight: 700,
                  letterSpacing: '-.02em',
                  color: '#EDEFF1',
                  margin: 0,
                }}
              >
                {t.benTitle}
              </h2>
              <p
                style={{
                  fontSize: '18px',
                  lineHeight: 1.6,
                  color: '#9A9DA1',
                  margin: '14px 0 0',
                }}
              >
                {t.benSub}
              </p>
            </div>

            <div
              className="stagger"
              style={{
                marginTop: '56px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(248px,1fr))',
                gap: '20px',
              }}
            >
              {t.benefits.map((item, i) => (
                <div
                  key={i}
                  className="reveal mcard tilt brushed"
                  style={{
                    position: 'relative',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    border: '1px solid #3a3d42',
                    boxShadow: '0 18px 44px rgba(0,0,0,.4)',
                  }}
                >
                  <span className="msheen" />
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      padding: '28px',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(160deg,#43464b,#1b1d21)',
                        border: '1px solid #4a4d52',
                        color: '#D4D6D9',
                        boxShadow: '0 1px 0 rgba(255,255,255,.1) inset',
                      }}
                    >
                      {BEN_ICONS[i]}
                    </div>
                    <h3
                      style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        color: '#EDEFF1',
                        margin: '20px 0 0',
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '14.5px',
                        lineHeight: 1.6,
                        color: '#9A9DA1',
                        margin: '9px 0 0',
                      }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Software logos marquee ─────────────────────────────────────── */}
        <section
          id="software"
          style={{
            position: 'relative',
            padding: 'clamp(86px,11vw,128px) 0',
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
            <div
              className="reveal"
              style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}
            >
              <h2
                style={{
                  fontSize: 'clamp(30px,3.4vw,40px)',
                  fontWeight: 700,
                  letterSpacing: '-.02em',
                  color: '#EDEFF1',
                  margin: 0,
                }}
              >
                {t.swTitle}
              </h2>
              <p
                style={{
                  fontSize: '18px',
                  lineHeight: 1.6,
                  color: '#9A9DA1',
                  margin: '14px 0 0',
                }}
              >
                {t.swSub}
              </p>
            </div>

            <div className="reveal" style={{ marginTop: '52px' }}>
              <div
                className="marquee"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  WebkitMaskImage:
                    'linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)',
                  maskImage:
                    'linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)',
                }}
              >
                <div className="marquee-track" style={{ display: 'flex', width: 'max-content' }}>
                  {SW_LOGOS_LOOP.map((logo, i) => (
                    <div
                      key={i}
                      className="brushed mcard"
                      style={{
                        position: 'relative',
                        overflow: 'hidden',
                        flex: '0 0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '76px',
                        padding: '0 40px',
                        marginRight: '14px',
                        border: '1px solid #3a3d42',
                        borderRadius: '14px',
                        color: '#C0C2C5',
                      }}
                    >
                      <span className="msheen" />
                      <span
                        style={{
                          position: 'relative',
                          zIndex: 2,
                          fontSize: '17px',
                          fontWeight: 600,
                          letterSpacing: '-.01em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {logo}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="reveal"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '9px',
                marginTop: '30px',
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: '#C0C2C5',
                }}
              />
              <span
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: '12px',
                  letterSpacing: '.1em',
                  color: '#9A9DA1',
                  textTransform: 'uppercase',
                }}
              >
                {t.swNote}
              </span>
            </div>
          </div>
        </section>

        {/* ── Trust / security banner ────────────────────────────────────── */}
        <section style={{ padding: 'clamp(60px,8vw,86px) 0' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
            <div
              className="reveal brushed"
              style={{
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid #3a3d42',
                borderRadius: '22px',
                boxShadow: '0 22px 54px rgba(0,0,0,.42)',
              }}
            >
              <span className="sweep" style={{ animationDuration: '8s' }} />
              <div style={{ position: 'relative', zIndex: 2, padding: '44px 40px' }}>
                <div
                  style={{
                    textAlign: 'center',
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: '12px',
                    letterSpacing: '.16em',
                    textTransform: 'uppercase',
                    color: '#C0C2C5',
                    marginBottom: '34px',
                  }}
                >
                  {t.trustTitle}
                </div>
                <div
                  className="stagger"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
                    gap: '22px',
                  }}
                >
                  {t.trust.map((item, i) => (
                    <div
                      key={i}
                      className="reveal"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(160deg,#43464b,#16181b)',
                          border: '1px solid #4a4d52',
                          color: '#D4D6D9',
                          flexShrink: 0,
                          boxShadow: '0 1px 0 rgba(255,255,255,.1) inset',
                        }}
                      >
                        {TRUST_ICONS[i]}
                      </span>
                      <span style={{ fontSize: '16px', fontWeight: 500, color: '#EDEFF1' }}>
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA section ──────────────────────────────────────────── */}
        <section
          style={{
            position: 'relative',
            padding: 'clamp(96px,13vw,150px) 0',
            overflow: 'hidden',
            background:
              'radial-gradient(60% 80% at 50% 50%,rgba(192,194,197,.08),transparent 68%)',
          }}
        >
          <div
            className="reveal"
            style={{
              position: 'relative',
              zIndex: 2,
              maxWidth: '840px',
              margin: '0 auto',
              padding: '0 24px',
            }}
          >
            <div
              className="brushed"
              style={{
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid #4a4d52',
                borderRadius: '26px',
                boxShadow: '0 40px 90px rgba(0,0,0,.55),0 2px 0 rgba(255,255,255,.1) inset',
              }}
            >
              <span className="sweep" style={{ animationDuration: '7.5s' }} />
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  padding: 'clamp(48px,7vw,72px) 32px',
                  textAlign: 'center',
                }}
              >
                <h2
                  style={{
                    fontSize: 'clamp(32px,4.4vw,52px)',
                    fontWeight: 700,
                    letterSpacing: '-.025em',
                    color: '#EDEFF1',
                    margin: 0,
                  }}
                >
                  {t.finalTitle}
                </h2>
                <p
                  style={{
                    fontSize: 'clamp(16px,1.4vw,19px)',
                    lineHeight: 1.6,
                    color: '#9A9DA1',
                    margin: '20px auto 0',
                    maxWidth: '520px',
                  }}
                >
                  {t.finalSub}
                </p>
                <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'center' }}>
                  <button
                    className="btn-shine"
                    onClick={goLogin}
                    style={{
                      fontFamily: 'inherit',
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#0E0F11',
                      background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)',
                      border: 'none',
                      borderRadius: '999px',
                      padding: '16px 36px',
                      cursor: 'pointer',
                      transition: 'transform .25s ease,box-shadow .25s ease,filter .25s ease',
                      boxShadow: '0 1px 0 rgba(255,255,255,.5) inset,0 8px 28px rgba(0,0,0,.4)',
                    }}
                  >
                    {t.finalCta}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,.06)',
          padding: '64px 0 40px',
          background: 'transparent',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '48px',
              justifyContent: 'space-between',
            }}
          >
            {/* Brand col */}
            <div style={{ flex: '2 1 260px', minWidth: '240px' }}>
              <a
                href="#top"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textDecoration: 'none',
                }}
              >
                <span
                  style={{
                    width: '11px',
                    height: '11px',
                    background: 'linear-gradient(135deg,#E6E8EA,#9A9DA1)',
                    transform: 'rotate(45deg)',
                    borderRadius: '2px',
                  }}
                />
                <span
                  style={{
                    fontSize: '19px',
                    fontWeight: 700,
                    letterSpacing: '-.01em',
                    color: '#EDEFF1',
                  }}
                >
                  Yield2Pay
                </span>
              </a>
              <p
                style={{
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: '#9A9DA1',
                  margin: '16px 0 0',
                  maxWidth: '260px',
                }}
              >
                {t.footTagline}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  marginTop: '22px',
                }}
              >
                <LangToggle lang={lang} setLang={setLang} />
                <div style={{ display: 'flex', gap: '9px' }}>
                  {/* X / Twitter */}
                  <a
                    href="#"
                    aria-label="X / Twitter"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      border: '1px solid #2A2D31',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9A9DA1',
                      textDecoration: 'none',
                      transition: 'all .25s ease',
                    }}
                  >
                    <svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M5 5l14 14" />
                      <path d="M19 5L5 19" />
                    </svg>
                  </a>
                  {/* LinkedIn */}
                  <a
                    href="#"
                    aria-label="LinkedIn"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      border: '1px solid #2A2D31',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9A9DA1',
                      textDecoration: 'none',
                      transition: 'all .25s ease',
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    in
                  </a>
                  {/* Email */}
                  <a
                    href="#"
                    aria-label="Email"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      border: '1px solid #2A2D31',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9A9DA1',
                      textDecoration: 'none',
                      transition: 'all .25s ease',
                    }}
                  >
                    <svg
                      width={15}
                      height={15}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="5.5" width="18" height="13" rx="2" />
                      <path d="M4 7l8 6 8-6" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Product col */}
            <div style={{ minWidth: '130px' }}>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: '11px',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: '#9A9DA1',
                  marginBottom: '16px',
                }}
              >
                {t.footProduct}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                {t.footProductLinks.map((link, i) => (
                  <a
                    key={i}
                    href="#"
                    style={{
                      fontSize: '14px',
                      color: '#C8CACD',
                      textDecoration: 'none',
                      transition: 'color .2s ease',
                    }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>

            {/* Company col */}
            <div style={{ minWidth: '130px' }}>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: '11px',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: '#9A9DA1',
                  marginBottom: '16px',
                }}
              >
                {t.footCompany}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                {t.footCompanyLinks.map((link, i) => (
                  <a
                    key={i}
                    href="#"
                    style={{
                      fontSize: '14px',
                      color: '#C8CACD',
                      textDecoration: 'none',
                      transition: 'color .2s ease',
                    }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>

            {/* Legal col */}
            <div style={{ minWidth: '130px' }}>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: '11px',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: '#9A9DA1',
                  marginBottom: '16px',
                }}
              >
                {t.footLegal}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                {t.footLegalLinks.map((link, i) => (
                  <a
                    key={i}
                    href={i === 0 ? '/termos' : '/privacidade'}
                    style={{
                      fontSize: '14px',
                      color: '#C8CACD',
                      textDecoration: 'none',
                      transition: 'color .2s ease',
                    }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            style={{
              marginTop: '48px',
              paddingTop: '24px',
              borderTop: '1px solid rgba(255,255,255,.05)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '14px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '13px', color: '#7E8186' }}>{t.copyright}</span>
            <span
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: '11px',
                letterSpacing: '.08em',
                color: '#5F6266',
                textTransform: 'uppercase',
              }}
            >
              Prototype
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
