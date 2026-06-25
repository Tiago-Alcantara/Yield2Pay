'use client';

/**
 * FixEarn Auth Screen — login/page.tsx
 *
 * Google-only login. The right panel shows a single "Continue with Google"
 * button that kicks off Privy's headless OAuth redirect
 * (useLoginWithOAuth().initOAuth) — no email/password, no Privy modal.
 * On success Privy redirects back here; the effect below forwards the
 * authenticated user to the dashboard.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrivy, useLoginWithOAuth } from '@privy-io/react-auth';
import { useIsMobile } from '@/lib/useIsMobile';

// ── Dictionary ────────────────────────────────────────────────────────────────

const L = {
  en: {
    brandTitle: 'Put your idle capital to work.',
    brandSub: 'The returns on your deposit cover the software your business runs on.',
    seals: [
      ['shield', 'Capital protected'],
      ['lock', 'Bank-grade security'],
      ['cube', 'Blockchain-powered'],
    ] as [string, string][],
    title: 'Welcome to FixEarn',
    subtitle: 'Sign in with your Google account to continue.',
    google: 'Continue with Google',
    loading: 'Redirecting…',
    error: 'Could not start Google sign-in. Please try again.',
    legal: 'By continuing you agree to our Terms and Privacy Policy.',
  },
  pt: {
    brandTitle: 'Coloque seu capital parado para trabalhar.',
    brandSub: 'O rendimento do seu aporte cobre os softwares que sua empresa usa.',
    seals: [
      ['shield', 'Capital protegido'],
      ['lock', 'Segurança bancária'],
      ['cube', 'Tecnologia blockchain'],
    ] as [string, string][],
    title: 'Bem-vindo à FixEarn',
    subtitle: 'Entre com sua conta Google para continuar.',
    google: 'Continuar com Google',
    loading: 'Redirecionando…',
    error: 'Não foi possível iniciar o login com Google. Tente novamente.',
    legal: 'Ao continuar, você concorda com nossos Termos e Política de Privacidade.',
  },
} as const;

type Lang = keyof typeof L;

// ── SVG helpers ───────────────────────────────────────────────────────────────

function SealIcon({ name }: { name: string }) {
  const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  if (name === 'shield') return (
    <svg {...base}>
      <path d="M12 3.5l7 2.6v5.4c0 4-3 6.7-7 7.9-4-1.2-7-3.9-7-7.9V6.1z" />
      <path d="M9 12l2 2 4-4.5" />
    </svg>
  );
  if (name === 'cube') return (
    <svg {...base}>
      <path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z" />
      <path d="M12 3.5v17" />
      <path d="M4.5 7.7L12 12l7.5-4.3" />
    </svg>
  );
  // lock
  return (
    <svg {...base}>
      <path d="M6.5 10.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { initOAuth, loading } = useLoginWithOAuth({
    onComplete: () => router.replace('/dashboard'),
    onError: (err) => {
      console.error('[FixEarn] Privy OAuth error:', err);
      setError(true);
    },
  });
  const isMobile = useIsMobile();

  const [lang, setLang] = useState<Lang>('en');
  const [error, setError] = useState(false);

  const t = L[lang];

  // Already authenticated (or just returned from the Google redirect) → leave.
  useEffect(() => {
    if (ready && authenticated) router.replace('/dashboard');
  }, [ready, authenticated, router]);

  async function signInWithGoogle() {
    setError(false);
    try {
      await initOAuth({ provider: 'google' });
    } catch {
      setError(true);
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const tabBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 999,
    padding: '5px 12px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '.03em',
  };

  // ── Global CSS injection for animations ──────────────────────────────────

  const globalCss = `
    *{box-sizing:border-box}
    body{margin:0;background:#0c0d0f;color:#EDEFF1;font-family:'Hanken Grotesk',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
    ::selection{background:rgba(192,194,197,.25);color:#fff}
    :focus-visible{outline:2px solid #C0C2C5;outline-offset:2px;border-radius:6px}
    .fx-metal{background:#0a0b0d}
    .fx-metal::before{content:"";position:absolute;inset:-45%;background:linear-gradient(122deg,#090a0c 0%,#1c1f23 22%,#41454c 46%,#23262b 60%,#0c0d0f 82%,#090a0c 100%);background-size:230% 230%;animation:fxMetalShift 22s ease-in-out infinite}
    .fx-metal::after{content:"";position:absolute;inset:0;background:radial-gradient(72% 56% at 28% 20%,rgba(212,214,217,.14),transparent 58%),radial-gradient(90% 75% at 84% 108%,rgba(0,0,0,.6),transparent 60%);box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}
    .fx-grain{position:absolute;inset:0;z-index:1;background:repeating-linear-gradient(118deg,rgba(255,255,255,.035) 0,rgba(255,255,255,.035) 1px,transparent 1px,transparent 5px);opacity:.55;pointer-events:none}
    .fx-sweep{position:absolute;top:0;bottom:0;left:0;width:48%;z-index:1;background:linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent);transform:skewX(-12deg) translateX(-150%);animation:fxBrandSweep 9.5s ease-in-out infinite;pointer-events:none}
    .fx-form{animation:fxFade .4s ease both}
    .fx-google{transition:all .25s ease}
    .fx-google:hover:not(:disabled){background:rgba(255,255,255,.06);border-color:#4A4D51}
    .fx-google:disabled{opacity:.6;cursor:default}
    @keyframes fxMetalShift{0%{background-position:100% 0%}50%{background-position:0% 100%}100%{background-position:100% 0%}}
    @keyframes fxBrandSweep{0%{transform:skewX(-12deg) translateX(-160%)}58%,100%{transform:skewX(-12deg) translateX(280%)}}
    @keyframes fxFade{from{transform:translateY(7px)}to{transform:translateY(0)}}
    @media (prefers-reduced-motion:reduce){.fx-metal::before,.fx-sweep,.fx-form{animation:none}}
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalCss }} />

      <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100vh', position: 'relative' }}>

        {/* ── Language toggle (top-right) ───────────────────────────────── */}
        <div style={{ position: 'absolute', top: 20, right: 22, zIndex: 20 }}>
          <div
            role="group"
            aria-label="Language"
            style={{ display: 'inline-flex', border: '1px solid #2A2D31', borderRadius: 999, padding: 3, gap: 2, background: 'rgba(22,24,27,.7)', backdropFilter: 'blur(8px)' }}
          >
            <button
              type="button"
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
              style={{ ...tabBase, background: lang === 'en' ? '#2E3136' : 'transparent', color: lang === 'en' ? '#F2F3F4' : '#9A9DA1' }}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('pt')}
              aria-pressed={lang === 'pt'}
              style={{ ...tabBase, background: lang === 'pt' ? '#2E3136' : 'transparent', color: lang === 'pt' ? '#F2F3F4' : '#9A9DA1' }}
            >
              PT
            </button>
          </div>
        </div>

        {/* ── Left: brushed-metal brand panel (hidden on mobile) ───────── */}
        {!isMobile && (
        <section
          className="fx-metal"
          aria-hidden="false"
          style={{ position: 'relative', overflow: 'hidden', flex: '1 1 420px', minHeight: 240, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 'clamp(32px,4vw,56px)', borderRight: '1px solid #1A1C1F' }}
        >
          <span className="fx-grain" aria-hidden="true" />
          <span className="fx-sweep" aria-hidden="true" />

          {/* Logo */}
          <Link href="/" style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', width: 'max-content' }}>
            <span style={{ width: 13, height: 13, background: 'linear-gradient(135deg,#E6E8EA,#9A9DA1)', transform: 'rotate(45deg)', borderRadius: 2, boxShadow: '0 0 12px rgba(192,194,197,.35)' }} />
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', color: '#EDEFF1' }}>FixEarn</span>
          </Link>

          {/* Brand copy */}
          <div style={{ position: 'relative', zIndex: 2, padding: '48px 0' }}>
            <h2 style={{ fontSize: 'clamp(30px,3.6vw,46px)', fontWeight: 700, lineHeight: 1.08, letterSpacing: '-.025em', color: '#EDEFF1', margin: 0, maxWidth: 420, textShadow: '0 1px 0 rgba(255,255,255,.13),0 -1px 1px rgba(0,0,0,.6)' }}>
              {t.brandTitle}
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: '#9A9DA1', margin: '20px 0 0', maxWidth: 400 }}>
              {t.brandSub}
            </p>
          </div>

          {/* Trust seals */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {t.seals.map(([icon, label]) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: "'Geist Mono',monospace", fontSize: 12, letterSpacing: '.04em', color: '#C0C2C5' }}>
                <span style={{ color: '#C0C2C5', display: 'flex' }}><SealIcon name={icon} /></span>
                {label}
              </span>
            ))}
          </div>
        </section>
        )}

        {/* ── Right: Google sign-in panel ───────────────────────────────── */}
        <section style={{ flex: '1.15 1 480px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '24px 16px' : 'clamp(32px,5vw,64px) 24px', background: '#0c0d0f', minHeight: isMobile ? '100vh' : undefined }}>
          <div className="fx-form" style={{ width: '100%', maxWidth: 404, textAlign: 'center' }}>

            <h1 style={{ fontSize: 'clamp(26px,3vw,32px)', fontWeight: 700, letterSpacing: '-.02em', color: '#EDEFF1', margin: 0, textShadow: '0 1px 0 rgba(255,255,255,.1)' }}>
              {t.title}
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: '#9A9DA1', margin: '9px 0 28px' }}>
              {t.subtitle}
            </p>

            {/* Google OAuth button */}
            <button
              type="button"
              className="fx-google"
              onClick={signInWithGoogle}
              disabled={loading}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, fontFamily: 'inherit', fontSize: 15, fontWeight: 500, color: '#EDEFF1', background: 'rgba(255,255,255,.025)', border: '1px solid #3A3D41', borderRadius: 12, padding: 14, cursor: 'pointer' }}
            >
              <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.2 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z" />
              </svg>
              {loading ? t.loading : t.google}
            </button>

            {error && (
              <div role="alert" style={{ fontSize: 13, color: '#D98A8A', marginTop: 14 }}>
                {t.error}
              </div>
            )}

            <p style={{ fontSize: 12.5, lineHeight: 1.5, color: '#7E8186', margin: '20px 0 0' }}>
              {t.legal}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
