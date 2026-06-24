'use client';

/**
 * FixEarn Auth Screen — login/page.tsx
 *
 * Faithfully reproduces design/reference/FixEarn Auth.dc.html:
 *   - Brushed-metal left panel with brand copy and trust seals
 *   - Right panel with segmented Login / Sign up toggle
 *   - Email + Password fields (password show/hide eye icon)
 *   - Company, Tax ID, Full name fields in signup mode
 *   - "Forgot password?" link in login mode
 *   - Terms & Privacy checkbox in signup mode
 *   - Chrome submit button (calls Privy login())
 *   - "or" divider + Google OAuth button
 *   - EN / PT language toggle (top-right)
 *   - All hex values, inline styles, and animations from the reference
 */

import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

// ── Dictionary (exact copy from reference renderVals()) ───────────────────────

const L = {
  en: {
    brandTitle: 'Put your idle capital to work.',
    brandSub: 'The returns on your deposit cover the software your business runs on.',
    seals: [
      ['shield', 'Capital protected'],
      ['lock', 'Bank-grade security'],
      ['cube', 'Blockchain-powered'],
    ] as [string, string][],
    login: { title: 'Welcome back', subtitle: 'Log in to your FixEarn account', cta: 'Log in', google: 'Continue with Google' },
    signup: { title: 'Create your business account', subtitle: 'Start putting your capital to work in minutes', cta: 'Create account', google: 'Sign up with Google' },
    forgot: 'Forgot password?', or: 'or',
    loginSwitchPrompt: "Don't have an account?", loginSwitchAction: 'Sign up',
    signupSwitchPrompt: 'Already have an account?', signupSwitchAction: 'Log in',
    meta: {
      email: { label: 'Work email', placeholder: 'you@company.com', auto: 'email' },
      password: { label: 'Password', placeholder: '••••••••', auto: 'current-password' },
      company: { label: 'Company name', placeholder: 'Acme Inc.', auto: 'organization' },
      taxid: { label: 'Tax ID', placeholder: '00.000.000/0000-00', auto: 'off', note: 'Format depends on your country (e.g. CNPJ in Brazil, EIN in the US).' },
      name: { label: 'Full name', placeholder: 'Jordan Avery', auto: 'name' },
    },
    err: { email: 'Enter a valid email', password: 'Use at least 8 characters', company: 'Enter your company name', taxid: 'Enter a valid Tax ID', name: 'Enter your full name' },
    strength: ['Too short', 'Weak password', 'Fair password', 'Strong password'],
    terms: { prefix: 'I agree to the ', link: 'Terms', mid: ' and ', privacy: 'Privacy Policy', error: 'Please accept the Terms to continue.' },
    showPw: 'Show password', hidePw: 'Hide password',
  },
  pt: {
    brandTitle: 'Coloque seu capital parado para trabalhar.',
    brandSub: 'O rendimento do seu aporte cobre os softwares que sua empresa usa.',
    seals: [
      ['shield', 'Capital protegido'],
      ['lock', 'Segurança bancária'],
      ['cube', 'Tecnologia blockchain'],
    ] as [string, string][],
    login: { title: 'Bem-vindo de volta', subtitle: 'Acesse sua conta FixEarn', cta: 'Entrar', google: 'Continuar com Google' },
    signup: { title: 'Crie sua conta empresarial', subtitle: 'Comece a colocar seu capital para trabalhar em minutos', cta: 'Criar conta', google: 'Cadastrar com Google' },
    forgot: 'Esqueceu a senha?', or: 'ou',
    loginSwitchPrompt: 'Não tem uma conta?', loginSwitchAction: 'Criar conta',
    signupSwitchPrompt: 'Já tem uma conta?', signupSwitchAction: 'Entrar',
    meta: {
      email: { label: 'E-mail corporativo', placeholder: 'voce@empresa.com', auto: 'email' },
      password: { label: 'Senha', placeholder: '••••••••', auto: 'current-password' },
      company: { label: 'Nome da empresa', placeholder: 'Acme Ltda.', auto: 'organization' },
      taxid: { label: 'CNPJ', placeholder: '00.000.000/0000-00', auto: 'off', note: 'O formato depende do país (ex.: CNPJ no Brasil, EIN nos EUA).' },
      name: { label: 'Nome completo', placeholder: 'Jordan Avery', auto: 'name' },
    },
    err: { email: 'Digite um e-mail válido', password: 'Use ao menos 8 caracteres', company: 'Digite o nome da empresa', taxid: 'Digite um CNPJ válido', name: 'Digite seu nome completo' },
    strength: ['Muito curta', 'Senha fraca', 'Senha razoável', 'Senha forte'],
    terms: { prefix: 'Concordo com os ', link: 'Termos', mid: ' e a ', privacy: 'Política de Privacidade', error: 'Aceite os Termos para continuar.' },
    showPw: 'Mostrar senha', hidePw: 'Ocultar senha',
  },
} as const;

type Lang = keyof typeof L;
type Mode = 'login' | 'signup';
type FieldKey = 'email' | 'password' | 'company' | 'taxid' | 'name';

// ── SVG helpers ───────────────────────────────────────────────────────────────

function EyeOpen() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.4 5.3A9 9 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-3.3 4" />
      <path d="M6.2 7.2A16 16 0 0 0 2.5 12S6 19 12 19a8.7 8.7 0 0 0 3.8-.9" />
    </svg>
  );
}

function EyeClosed() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx={12} cy={12} r={2.6} />
    </svg>
  );
}

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

// ── Validation rules ──────────────────────────────────────────────────────────

function validate(key: FieldKey, value: string): boolean {
  switch (key) {
    case 'email': return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
    case 'password': return value.length >= 8;
    case 'company': return value.trim().length >= 2;
    case 'taxid': return value.trim().length >= 4;
    case 'name': return value.trim().length >= 2;
  }
}

function pwStrength(pw: string): 0 | 1 | 2 | 3 {
  let sc = 0;
  if (pw.length >= 8) sc++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) sc++;
  if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) sc++;
  return sc as 0 | 1 | 2 | 3;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login } = usePrivy();

  const [lang, setLang] = useState<Lang>('en');
  const [mode, setMode] = useState<Mode>('login');
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const t = L[lang];
  const isLogin = mode === 'login';
  const m = isLogin ? t.login : t.signup;
  const loginKeys: FieldKey[] = ['email', 'password'];
  const signupKeys: FieldKey[] = ['company', 'taxid', 'name', 'email', 'password'];
  const activeKeys = isLogin ? loginKeys : signupKeys;

  function toggleMode() {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    setSubmitted(false);
    setTouched({});
  }

  function setVal(key: FieldKey, val: string) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function setTouch(key: FieldKey) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const allValid = activeKeys.every((k) => validate(k, values[k] ?? ''));
    const ok = allValid && (isLogin || agree);
    if (!ok) return;
    // Wire to Privy login for auth. In a production flow the email/password
    // would be passed to the Privy email-auth flow, but for the MVP we call
    // the top-level login() which opens the Privy auth modal.
    login();
  }

  // ── Shared styles ─────────────────────────────────────────────────────────

  const inputBase: React.CSSProperties = {
    width: '100%',
    background: '#16181B',
    border: '1px solid #2A2D31',
    borderRadius: 12,
    padding: '13px 14px',
    color: '#F2F3F4',
    fontFamily: "'Geist Mono', monospace",
    fontSize: 15,
    outline: 'none',
    transition: 'border-color .2s ease, box-shadow .2s ease',
  };

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

  const primaryStyle: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: 600,
    color: '#0E0F11',
    background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)',
    border: 'none',
    borderRadius: 12,
    padding: 15,
    cursor: 'pointer',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 50,
    width: '100%',
    boxShadow: '0 1px 0 rgba(255,255,255,.5) inset, 0 8px 24px rgba(0,0,0,.4)',
    transition: 'transform .25s ease, box-shadow .25s ease, filter .25s ease',
    opacity: 1,
  };

  // ── Global CSS injection for animations ──────────────────────────────────

  const globalCss = `
    *{box-sizing:border-box}
    body{margin:0;background:#0c0d0f;color:#EDEFF1;font-family:'Hanken Grotesk',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
    ::selection{background:rgba(192,194,197,.25);color:#fff}
    input::placeholder{color:#6b6e73}
    :focus-visible{outline:2px solid #C0C2C5;outline-offset:2px;border-radius:6px}
    .fx-metal{background:#0a0b0d}
    .fx-metal::before{content:"";position:absolute;inset:-45%;background:linear-gradient(122deg,#090a0c 0%,#1c1f23 22%,#41454c 46%,#23262b 60%,#0c0d0f 82%,#090a0c 100%);background-size:230% 230%;animation:fxMetalShift 22s ease-in-out infinite}
    .fx-metal::after{content:"";position:absolute;inset:0;background:radial-gradient(72% 56% at 28% 20%,rgba(212,214,217,.14),transparent 58%),radial-gradient(90% 75% at 84% 108%,rgba(0,0,0,.6),transparent 60%);box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}
    .fx-grain{position:absolute;inset:0;z-index:1;background:repeating-linear-gradient(118deg,rgba(255,255,255,.035) 0,rgba(255,255,255,.035) 1px,transparent 1px,transparent 5px);opacity:.55;pointer-events:none}
    .fx-sweep{position:absolute;top:0;bottom:0;left:0;width:48%;z-index:1;background:linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent);transform:skewX(-12deg) translateX(-150%);animation:fxBrandSweep 9.5s ease-in-out infinite;pointer-events:none}
    .fx-form{animation:fxFade .4s ease both}
    .fx-btn-shine{position:relative;overflow:hidden}
    .fx-btn-shine::before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 26%,rgba(255,255,255,.5) 48%,transparent 68%);transform:translateX(-135%);transition:transform .6s ease;pointer-events:none}
    .fx-btn-shine:hover::before{transform:translateX(135%)}
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

        {/* ── Left: brushed-metal brand panel ──────────────────────────── */}
        <section
          className="fx-metal"
          aria-hidden="false"
          style={{ position: 'relative', overflow: 'hidden', flex: '1 1 420px', minHeight: 240, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 'clamp(32px,4vw,56px)', borderRight: '1px solid #1A1C1F' }}
        >
          <span className="fx-grain" aria-hidden="true" />
          <span className="fx-sweep" aria-hidden="true" />

          {/* Logo */}
          <a href="/" style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', width: 'max-content' }}>
            <span style={{ width: 13, height: 13, background: 'linear-gradient(135deg,#E6E8EA,#9A9DA1)', transform: 'rotate(45deg)', borderRadius: 2, boxShadow: '0 0 12px rgba(192,194,197,.35)' }} />
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', color: '#EDEFF1' }}>FixEarn</span>
          </a>

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

        {/* ── Right: form panel ─────────────────────────────────────────── */}
        <section style={{ flex: '1.15 1 480px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(32px,5vw,64px) 24px', background: '#0c0d0f' }}>
          <div className="fx-form" style={{ width: '100%', maxWidth: 404 }}>

            {/* Mode segmented toggle */}
            <div style={{ display: 'inline-flex', border: '1px solid #2A2D31', borderRadius: 999, padding: 3, gap: 2, background: 'rgba(22,24,27,.7)', marginBottom: 28 }}>
              <button
                type="button"
                onClick={() => { setMode('login'); setSubmitted(false); setTouched({}); }}
                aria-pressed={isLogin}
                style={{ ...tabBase, fontSize: 13, padding: '6px 16px', background: isLogin ? '#2E3136' : 'transparent', color: isLogin ? '#F2F3F4' : '#9A9DA1' }}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setSubmitted(false); setTouched({}); }}
                aria-pressed={!isLogin}
                style={{ ...tabBase, fontSize: 13, padding: '6px 16px', background: !isLogin ? '#2E3136' : 'transparent', color: !isLogin ? '#F2F3F4' : '#9A9DA1' }}
              >
                Sign up
              </button>
            </div>

            <h1 style={{ fontSize: 'clamp(26px,3vw,32px)', fontWeight: 700, letterSpacing: '-.02em', color: '#EDEFF1', margin: 0, textShadow: '0 1px 0 rgba(255,255,255,.1)' }}>
              {m.title}
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: '#9A9DA1', margin: '9px 0 0' }}>
              {m.subtitle}
            </p>

            <form onSubmit={handleSubmit} noValidate style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Dynamic fields */}
              {activeKeys.map((key) => {
                const value = values[key] ?? '';
                const valid = validate(key, value);
                const reveal = !!(touched[key] || submitted);
                const hasError = reveal && !valid && (value.length > 0 || submitted);
                const isPassword = key === 'password';
                const showCheck = valid && value.length > 0 && !isPassword;
                const inputType = isPassword ? (show ? 'text' : 'password') : key === 'email' ? 'email' : 'text';
                const padRight = isPassword ? '44px' : showCheck ? '40px' : '14px';
                const sc = pwStrength(value);
                const showStrength = isPassword && !isLogin && value.length > 0;
                const showNote = !isLogin && key === 'taxid' && (t.meta[key] as { note?: string }).note;

                const inputStyle: React.CSSProperties = {
                  ...inputBase,
                  borderColor: hasError ? '#A24A4A' : '#2A2D31',
                  paddingRight: padRight,
                };

                return (
                  <div key={key}>
                    <label
                      htmlFor={`fx-${key}`}
                      style={{ display: 'block', fontFamily: "'Geist Mono',monospace", fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8a8d91', marginBottom: 8 }}
                    >
                      {t.meta[key].label}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id={`fx-${key}`}
                        type={inputType}
                        value={value}
                        placeholder={t.meta[key].placeholder}
                        onChange={(e) => setVal(key, e.target.value)}
                        onBlur={() => setTouch(key)}
                        autoComplete={t.meta[key].auto}
                        aria-invalid={hasError}
                        style={inputStyle}
                      />
                      {isPassword && (
                        <button
                          type="button"
                          onClick={() => setShow((s) => !s)}
                          aria-label={show ? t.hidePw : t.showPw}
                          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9A9DA1', padding: 6, display: 'flex', alignItems: 'center' }}
                        >
                          {show ? <EyeOpen /> : <EyeClosed />}
                        </button>
                      )}
                      {showCheck && (
                        <span
                          aria-hidden="true"
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#0E0F11" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l4 4 10-11" />
                          </svg>
                        </span>
                      )}
                    </div>
                    {showStrength && (
                      <div style={{ marginTop: 9 }}>
                        <div style={{ height: 4, background: '#16181B', border: '1px solid #2A2D31', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(sc / 3) * 100}%`, background: 'linear-gradient(90deg,#A8AAAD,#E6E8EA)', borderRadius: 999, transition: 'width .3s ease' }} />
                        </div>
                        <div style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: '#9A9DA1', marginTop: 6 }}>
                          {t.strength[sc]}
                        </div>
                      </div>
                    )}
                    {showNote && (
                      <div style={{ fontSize: 12, color: '#7E8186', marginTop: 7 }}>
                        {showNote}
                      </div>
                    )}
                    {hasError && (
                      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#D98A8A', marginTop: 7 }}>
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                          <circle cx={12} cy={12} r={9} />
                          <path d="M12 8v5" />
                          <path d="M12 16.5v.01" />
                        </svg>
                        {t.err[key]}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Forgot password (login mode only) */}
              {isLogin && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4 }}>
                  <a href="#" style={{ fontSize: 13.5, color: '#9A9DA1', textDecoration: 'none' }}>
                    {t.forgot}
                  </a>
                </div>
              )}

              {/* Terms agreement (signup mode only) */}
              {!isLogin && (
                <div style={{ marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => setAgree((a) => !a)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 11, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, marginTop: 1, border: `1px solid ${agree ? 'transparent' : submitted && !agree ? '#A24A4A' : '#3A3D41'}`, background: agree ? 'linear-gradient(180deg,#E6E8EA,#A8AAAD)' : '#16181B', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s ease' }}>
                      {agree && (
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#0E0F11" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l4 4 10-11" />
                        </svg>
                      )}
                    </span>
                    <span style={{ fontSize: 13.5, lineHeight: 1.5, color: '#9A9DA1' }}>
                      {t.terms.prefix}
                      <a href="#" style={{ color: '#C0C2C5', textDecoration: 'underline', textUnderlineOffset: 2 }}>{t.terms.link}</a>
                      {t.terms.mid}
                      <a href="#" style={{ color: '#C0C2C5', textDecoration: 'underline', textUnderlineOffset: 2 }}>{t.terms.privacy}</a>
                    </span>
                  </button>
                  {submitted && !agree && (
                    <div role="alert" style={{ fontSize: 12.5, color: '#D98A8A', marginTop: 7 }}>
                      {t.terms.error}
                    </div>
                  )}
                </div>
              )}

              {/* Submit CTA */}
              <button type="submit" className="fx-btn-shine" style={primaryStyle}>
                {m.cta}
              </button>
            </form>

            {/* OR divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
              <span style={{ flex: 1, height: 1, background: '#2A2D31' }} />
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7E8186' }}>{t.or}</span>
              <span style={{ flex: 1, height: 1, background: '#2A2D31' }} />
            </div>

            {/* Google OAuth button */}
            <button
              type="button"
              onClick={() => login()}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, fontFamily: 'inherit', fontSize: 15, fontWeight: 500, color: '#EDEFF1', background: 'rgba(255,255,255,.025)', border: '1px solid #3A3D41', borderRadius: 12, padding: 13, cursor: 'pointer', transition: 'all .25s ease' }}
            >
              <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.2 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z" />
              </svg>
              {m.google}
            </button>

            {/* Switch mode prompt */}
            <p style={{ textAlign: 'center', fontSize: 14, color: '#9A9DA1', margin: '24px 0 0' }}>
              {isLogin ? t.loginSwitchPrompt : t.signupSwitchPrompt}{' '}
              <button
                type="button"
                onClick={toggleMode}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#C0C2C5' }}
              >
                {isLogin ? t.loginSwitchAction : t.signupSwitchAction}
              </button>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
