'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { createApi } from '@/lib/api';
import { formatUsdc } from '@/lib/money';
import type { SpendableView, Bill } from '@fixearn/shared';
import Bills from './Bills';
import { useIsMobile } from '@/lib/useIsMobile';

// ── i18n dictionary (dashboard-specific, mirrors the reference HTML) ──────────

const T = {
  en: {
    nav: {
      overview: 'Overview',
      deposit: 'My deposit',
      withdraw: 'Withdraw',
      services: 'Services',
      card: 'Virtual card',
      transactions: 'Transactions',
      settings: 'Settings',
    },
    logout: 'Log out',
    greeting: 'Welcome back, Acme',
    greetingSub: 'Your capital is working. Returns are covering your tools.',
    capitalTitle: 'Your deposit',
    capitalLabel: 'Total capital',
    capitalSub: 'Your money, always',
    returnsTitle: 'Monthly returns',
    returnsLabel: 'Generated this month',
    returnsSub: '▲ +3.2% vs last month',
    spendableTitle: 'Available to spend',
    spendableLabel: 'After active subscriptions',
    spendableSub: 'Unused returns are reinvested',
    apyLabel: 'Annual yield',
    barTitle: 'Your returns at a glance',
    usage: (p: number) => `You're using ${p}% of your monthly returns`,
    committedLabel: 'Committed',
    availableLabel: 'Available',
    totalLabel: 'Total monthly return',
    servicesTitle: 'Registered subscriptions',
    servicesSub: 'Bills covered by your returns.',
    tabs: { all: 'All', software: 'Software', utility: 'Utility', other: 'Other' },
    activeBadge: 'Active',
    loading: 'Loading…',
    error: 'Error loading dashboard.',
    noServices: 'No subscriptions found.',
    // Activation checklist
    actTitle: 'Activate your account',
    actSub: "You're almost there. Complete the remaining 3 tasks to activate your account.",
    actDone: 'Submitted',
    actAction: 'Requires action',
    tasks: [
      ['business', 'Business details', 'done'],
      ['taxid', 'Tax ID', 'done'],
      ['bank', 'Bank connection', 'done'],
      ['deposit', 'Make your first deposit', 'action'],
      ['services', 'Choose your tools', 'action'],
      ['card', 'Activate virtual card', 'action'],
    ] as const,
    // Deposit CTA
    depositTitle: 'Add to your deposit',
    depositSub: 'More capital means more returns to cover your tools.',
    estReturn: 'Estimated extra return: ~$42.00/month',
    depositCta: 'Deposit via PIX',
    depositSecurity: 'Secure transfer · Funds invested automatically',
    // Virtual card
    cardText: 'This card pays for your active subscriptions automatically, funded by your returns.',
    cardSettings: 'Card settings',
  },
  pt: {
    nav: {
      overview: 'Visão geral',
      deposit: 'Meu aporte',
      withdraw: 'Sacar',
      services: 'Serviços',
      card: 'Cartão virtual',
      transactions: 'Transações',
      settings: 'Configurações',
    },
    logout: 'Sair',
    greeting: 'Bem-vindo, Acme',
    greetingSub: 'Seu capital está rendendo. O rendimento cobre suas ferramentas.',
    capitalTitle: 'Seu aporte',
    capitalLabel: 'Capital total',
    capitalSub: 'Sempre seu',
    returnsTitle: 'Rendimento mensal',
    returnsLabel: 'Gerado este mês',
    returnsSub: '▲ +3,2% vs mês anterior',
    spendableTitle: 'Disponível para usar',
    spendableLabel: 'Após assinaturas ativas',
    spendableSub: 'A sobra é reinvestida',
    apyLabel: 'Rendimento anual',
    barTitle: 'Seu rendimento de relance',
    usage: (p: number) => `Você está usando ${p}% do seu rendimento mensal`,
    committedLabel: 'Comprometido',
    availableLabel: 'Disponível',
    totalLabel: 'Rendimento mensal total',
    servicesTitle: 'Assinaturas registradas',
    servicesSub: 'Contas cobertas pelo seu rendimento.',
    tabs: { all: 'Todos', software: 'Software', utility: 'Utilidade', other: 'Outros' },
    activeBadge: 'Ativo',
    loading: 'Carregando…',
    error: 'Erro ao carregar o painel.',
    noServices: 'Nenhuma assinatura encontrada.',
    // Activation checklist
    actTitle: 'Ative sua conta',
    actSub: 'Você está quase lá. Conclua as 3 tarefas restantes para ativar sua conta.',
    actDone: 'Enviado',
    actAction: 'Requer ação',
    tasks: [
      ['business', 'Dados da empresa', 'done'],
      ['taxid', 'CNPJ', 'done'],
      ['bank', 'Conexão bancária', 'done'],
      ['deposit', 'Faça seu primeiro aporte', 'action'],
      ['services', 'Escolha suas ferramentas', 'action'],
      ['card', 'Ative o cartão virtual', 'action'],
    ] as const,
    // Deposit CTA
    depositTitle: 'Aumentar seu aporte',
    depositSub: 'Mais capital significa mais rendimento para cobrir suas ferramentas.',
    estReturn: 'Rendimento extra estimado: ~R$ 42,00/mês',
    depositCta: 'Aportar via PIX',
    depositSecurity: 'Transferência segura · Capital investido automaticamente',
    // Virtual card
    cardText: 'Este cartão paga suas assinaturas ativas automaticamente, com o seu rendimento.',
    cardSettings: 'Configurações do cartão',
  },
} as const;

type Lang = keyof typeof T;

// ── Nav icons (SVG, copied from reference) ────────────────────────────────────

function IconOverview() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}
function IconDeposit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v10" />
      <path d="M8 9l4 4 4-4" />
      <path d="M4 19h16" />
    </svg>
  );
}
function IconWithdraw() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21V11" />
      <path d="M8 15l4-4 4 4" />
      <path d="M4 5h16" />
    </svg>
  );
}
function IconServices() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="7" r="3.2" />
      <circle cx="17" cy="7" r="3.2" />
      <circle cx="7" cy="17" r="3.2" />
      <circle cx="17" cy="17" r="3.2" />
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 9.5h18" />
    </svg>
  );
}
function IconTransactions() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h9" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="M10 16l4-4-4-4" />
      <path d="M14 12H4" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b6e73" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// Task icons for the activation checklist
function IconBusiness() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 9h2M13 9h2M9 13h2M13 13h2M10 20v-3h4v3" />
    </svg>
  );
}
function IconTaxId() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10.5h4M7 14h8" />
    </svg>
  );
}
function IconBank() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10h16" />
      <path d="M5 10l7-4.5 7 4.5" />
      <path d="M6.5 10v7M10 10v7M14 10v7M17.5 10v7" />
      <path d="M4 20h16" />
    </svg>
  );
}

const TASK_ICONS: Record<string, React.ReactNode> = {
  business: <IconBusiness />,
  taxid: <IconTaxId />,
  bank: <IconBank />,
  deposit: <IconDeposit />,
  services: <IconServices />,
  card: <IconCard />,
};

const NAV_ITEMS: Array<{ id: string; icon: React.ReactNode; key: keyof typeof T['en']['nav'] }> = [
  { id: 'overview', icon: <IconOverview />, key: 'overview' },
  { id: 'deposit', icon: <IconDeposit />, key: 'deposit' },
  { id: 'withdraw', icon: <IconWithdraw />, key: 'withdraw' },
  { id: 'services', icon: <IconServices />, key: 'services' },
  { id: 'card', icon: <IconCard />, key: 'card' },
  { id: 'transactions', icon: <IconTransactions />, key: 'transactions' },
  { id: 'settings', icon: <IconSettings />, key: 'settings' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  label,
  sub,
  silver = false,
}: {
  title: string;
  value: string;
  label: string;
  sub: string;
  silver?: boolean;
}) {
  return (
    <div
      style={{
        background: '#1A1C1F',
        border: '1px solid #2A2D31',
        borderRadius: 18,
        padding: 24,
      }}
    >
      <div
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: '#9A9DA1',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 32,
          fontWeight: 600,
          color: silver ? '#C0C2C5' : '#F2F3F4',
          marginTop: 14,
          letterSpacing: '.01em',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 13.5, color: '#9A9DA1', marginTop: 8 }}>{label}</div>
      <div
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 12,
          color: '#C0C2C5',
          marginTop: 6,
        }}
      >
        {sub}
      </div>
    </div>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { getAccessToken, logout } = usePrivy();
  const api = useMemo(() => createApi(getAccessToken), [getAccessToken]);
  const isMobile = useIsMobile();

  const [lang, setLang] = useState<Lang>('en');
  const [nav, setNav] = useState('overview');
  const [tab, setTab] = useState('all');

  const [dashboard, setDashboard] = useState<SpendableView | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = T[lang];

  // Todos os setState ficam dentro do .then/.catch (assíncronos), para o effect
  // de mount não disparar setState síncrono (evita render em cascata).
  // `loading` já inicia true via useState, então não precisa setLoading(true) aqui.
  const fetchData = useCallback(() => {
    return Promise.all([api.getDashboard(), api.listBills()])
      .then(([dash, billList]) => {
        setDashboard(dash);
        setBills(billList);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      });
  }, [api]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  /** Called by <Bills/> after a successful create/delete so this page refetches both
   *  the bills list AND the dashboard (spendable/committed totals stay in sync). */
  const handleBillsChanged = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  const isEn = lang === 'en';

  const tabOrder: Array<{ id: string; label: string }> = [
    { id: 'all', label: t.tabs.all },
    { id: 'software', label: t.tabs.software },
    { id: 'utility', label: t.tabs.utility },
    { id: 'other', label: t.tabs.other },
  ];

  const tabBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 999,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all .2s ease',
  };

  const langTabBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 999,
    padding: '5px 12px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '.03em',
  };

  // ── Quick-amount chips (deposit CTA, static) ───────────────────────────────
  const quickAmounts = ['+R$ 5.000', '+R$ 10.000', '+R$ 20.000'];

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          background: '#0E0F11',
          color: '#9A9DA1',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Geist Mono', monospace",
          fontSize: 14,
        }}
      >
        {t.loading}
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          background: '#0E0F11',
          color: '#F2F3F4',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <span style={{ color: '#ff6b6b', fontSize: 16 }}>{t.error}</span>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#9A9DA1' }}>
          {error}
        </span>
      </div>
    );
  }

  // ── Derived values (dashboard is non-null past the guards above) ───────────
  const dash = dashboard!;

  // Monthly returns = vaultValue − principal (BigInt, base units → formatUsdc)
  const monthlyReturnsBase = (BigInt(dash.vaultValue) - BigInt(dash.principal)).toString();
  const monthlyReturnsFmt = formatUsdc(monthlyReturnsBase);

  // Committed = sum of all bill monthlyCost (BigInt sum)
  const committedBase = bills
    .reduce((sum, b) => sum + BigInt(b.monthlyCost), BigInt(0))
    .toString();
  const committedFmt = formatUsdc(committedBase);

  // Available = spendable
  const availableFmt = formatUsdc(dash.spendable);

  // Bar fill: committed as a % of monthly return (clamped 0–100)
  const totalReturn = BigInt(monthlyReturnsBase);
  const committedNum = BigInt(committedBase);
  const pct =
    totalReturn > BigInt(0)
      ? Math.min(100, Math.max(0, Number((committedNum * BigInt(100)) / totalReturn)))
      : 0;

  // Activation progress (static checklist)
  const doneCount = t.tasks.filter((task) => task[2] === 'done').length;
  const actPct = Math.round((doneCount / t.tasks.length) * 100);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        minHeight: '100vh',
        background: '#0E0F11',
        color: '#F2F3F4',
        fontFamily: "'Hanken Grotesk', system-ui, -apple-system, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        style={isMobile ? {
          flex: '0 0 auto',
          background: '#16181B',
          borderBottom: '1px solid #2A2D31',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 14px',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        } : {
          flex: '0 0 240px',
          background: '#16181B',
          borderRight: '1px solid #2A2D31',
          display: 'flex',
          flexDirection: 'column',
          padding: '22px 14px',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        {/* Brand */}
        <a
          href="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            padding: isMobile ? '4px 10px' : '6px 10px 22px',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              background: 'linear-gradient(135deg,#E6E8EA,#9A9DA1)',
              transform: 'rotate(45deg)',
              borderRadius: 2,
              boxShadow: '0 0 12px rgba(192,194,197,.35)',
            }}
          />
          <span
            style={{
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: '-.01em',
              color: '#F2F3F4',
            }}
          >
            FixEarn
          </span>
        </a>

        {/* Nav */}
        <nav style={isMobile ? {
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
          paddingBottom: 4,
        } : { display: 'flex', flexDirection: 'column', gap: 3 }}>
          {NAV_ITEMS.map((item) => {
            const on = nav === item.id;
            function handleNavClick() {
              if (item.id === 'deposit') {
                router.push('/deposit');
              } else if (item.id === 'withdraw') {
                router.push('/withdraw');
              } else {
                setNav(item.id);
              }
            }
            return (
              <button
                key={item.id}
                onClick={handleNavClick}
                style={isMobile ? {
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontFamily: 'inherit',
                  fontSize: 10,
                  fontWeight: on ? 600 : 500,
                  color: on ? '#F2F3F4' : '#9A9DA1',
                  background: on ? '#1f2226' : 'transparent',
                  whiteSpace: 'nowrap',
                } : {
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 10,
                  padding: '11px 12px',
                  fontFamily: 'inherit',
                  fontSize: 14.5,
                  fontWeight: on ? 600 : 500,
                  color: on ? '#F2F3F4' : '#9A9DA1',
                  background: on ? '#1f2226' : 'transparent',
                }}
              >
                {!isMobile && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 8,
                      bottom: 8,
                      width: 3,
                      borderRadius: '0 3px 3px 0',
                      background: on ? '#C0C2C5' : 'transparent',
                    }}
                  />
                )}
                <span style={{ display: 'flex', color: on ? '#F2F3F4' : '#9A9DA1' }}>
                  {item.icon}
                </span>
                <span>{t.nav[item.key]}</span>
              </button>
            );
          })}
        </nav>

        {/* User info */}
        {!isMobile && (
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '12px 10px',
            borderTop: '1px solid #2A2D31',
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(160deg,#43464b,#1b1d21)',
              border: '1px solid #4a4d52',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Geist Mono', monospace",
              fontSize: 12,
              color: '#D4D6D9',
            }}
          >
            AC
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontSize: 13.5,
                fontWeight: 600,
                color: '#F2F3F4',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Acme Ltda.
            </span>
            <span
              style={{
                display: 'block',
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10.5,
                color: '#9A9DA1',
              }}
            >
              Business
            </span>
          </span>
          <button
            aria-label={t.logout}
            onClick={() => logout()}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9A9DA1',
              display: 'flex',
              padding: 4,
            }}
          >
            <IconLogout />
          </button>
        </div>
        )}
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: isMobile ? 8 : 16,
            padding: isMobile ? '12px 16px' : '20px 32px',
            borderBottom: '1px solid #2A2D31',
            position: 'sticky',
            top: 0,
            background: 'rgba(14,15,17,.82)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            zIndex: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: isMobile ? 16 : 20,
                fontWeight: 700,
                letterSpacing: '-.015em',
                color: '#F2F3F4',
              }}
            >
              {t.greeting}
            </div>
            {!isMobile && (
              <div style={{ fontSize: 13.5, color: '#9A9DA1', marginTop: 2 }}>{t.greetingSub}</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Language switcher */}
            <div
              role="group"
              aria-label="Language"
              style={{
                display: 'inline-flex',
                border: '1px solid #2A2D31',
                borderRadius: 999,
                padding: 3,
                gap: 2,
                background: '#16181B',
              }}
            >
              <button
                onClick={() => setLang('en')}
                aria-pressed={isEn}
                style={{
                  ...langTabBase,
                  background: isEn ? '#2E3136' : 'transparent',
                  color: isEn ? '#F2F3F4' : '#9A9DA1',
                }}
              >
                EN
              </button>
              <button
                onClick={() => setLang('pt')}
                aria-pressed={!isEn}
                style={{
                  ...langTabBase,
                  background: !isEn ? '#2E3136' : 'transparent',
                  color: !isEn ? '#F2F3F4' : '#9A9DA1',
                }}
              >
                PT
              </button>
            </div>

            {/* Notifications bell */}
            <button
              aria-label="Notifications"
              style={{
                position: 'relative',
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: '1px solid #2A2D31',
                background: '#16181B',
                cursor: 'pointer',
                color: '#9A9DA1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconBell />
              <span
                style={{
                  position: 'absolute',
                  top: 9,
                  right: 10,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#D4D6D9',
                  boxShadow: '0 0 6px rgba(212,214,217,.8)',
                }}
              />
            </button>

            {/* Avatar */}
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'linear-gradient(160deg,#43464b,#1b1d21)',
                border: '1px solid #4a4d52',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Geist Mono', monospace",
                fontSize: 12,
                color: '#D4D6D9',
              }}
            >
              AC
            </span>
          </div>
        </header>

        {/* Body */}
        <div
          style={{
            padding: isMobile ? '16px 12px' : 32,
            maxWidth: 1180,
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* ── Activation checklist ────────────────────────────────────── */}
          <section
            style={{
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid #2A2D31',
              borderRadius: 20,
              background: 'linear-gradient(135deg,#15171b 0%,#0e0f11 72%)',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1.45fr 1fr',
            }}
          >
            {/* Left: title + progress + brushed diamond */}
            <div
              style={{
                position: 'relative',
                padding: isMobile ? '24px 20px' : '38px 34px',
                display: 'flex',
                flexDirection: 'column',
                minHeight: isMobile ? 'auto' : 360,
              }}
            >
              <h2
                style={{
                  fontSize: 'clamp(30px,3.8vw,50px)',
                  fontWeight: 800,
                  letterSpacing: '-.02em',
                  lineHeight: 1.02,
                  textTransform: 'uppercase',
                  color: '#F2F3F4',
                  margin: 0,
                  textShadow: '0 1px 0 rgba(255,255,255,.13),0 -1px 1px rgba(0,0,0,.6)',
                  maxWidth: 420,
                }}
              >
                {t.actTitle}
              </h2>
              <p
                style={{
                  fontSize: 15.5,
                  lineHeight: 1.55,
                  color: '#9A9DA1',
                  margin: '16px 0 0',
                  maxWidth: 380,
                }}
              >
                {t.actSub}
              </p>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: '#16181B',
                  border: '1px solid #2A2D31',
                  overflow: 'hidden',
                  marginTop: 22,
                  maxWidth: 380,
                }}
              >
                <div
                  style={{
                    width: `${actPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg,#A8AAAD,#E6E8EA)',
                    borderRadius: 999,
                  }}
                />
              </div>
              {!isMobile && (
              <div
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                  paddingTop: 30,
                  perspective: 900,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    width: 'clamp(140px,16vw,196px)',
                    height: 'clamp(140px,16vw,196px)',
                    borderRadius: 30,
                    border: '1px solid #4a4d52',
                    background:
                      'linear-gradient(135deg,#3c3f44 0%,#26282c 26%,#16181b 52%,#303338 74%,#1b1d21 100%)',
                    boxShadow:
                      '0 30px 70px rgba(0,0,0,.6),0 2px 0 rgba(255,255,255,.12) inset',
                    transform: 'rotateX(15deg) rotateZ(-7deg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      width: '44%',
                      height: '44%',
                      background: 'linear-gradient(135deg,#E6E8EA,#9A9DA1)',
                      transform: 'rotate(45deg)',
                      borderRadius: 10,
                      boxShadow:
                        '0 2px 5px rgba(0,0,0,.45),0 1px 0 rgba(255,255,255,.55) inset',
                    }}
                  />
                </div>
              </div>
              )}
            </div>

            {/* Right: 6-task checklist */}
            <div
              style={{
                background: '#16181B',
                borderLeft: isMobile ? 'none' : '1px solid #2A2D31',
                borderTop: isMobile ? '1px solid #2A2D31' : 'none',
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              {t.tasks.map(([id, title, status], i) => {
                const done = status === 'done';
                return (
                  <button
                    key={id}
                    onClick={() => {
                      if (id === 'deposit') router.push('/deposit');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: i < t.tasks.length - 1 ? '1px solid #2A2D31' : 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: '13px 14px',
                      borderRadius: 10,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        borderRadius: 11,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(160deg,#43464b,#1b1d21)',
                        border: '1px solid #4a4d52',
                        color: '#D4D6D9',
                      }}
                    >
                      {TASK_ICONS[id]}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 14.5,
                          fontWeight: 600,
                          color: '#F2F3F4',
                        }}
                      >
                        {title}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: 12,
                          marginTop: 3,
                          color: done ? '#9A9DA1' : '#C2A06A',
                        }}
                      >
                        {done ? t.actDone : t.actAction}
                      </span>
                    </span>
                    <IconChevron />
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Stat panels (capital / monthly returns / available) ───────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
              gap: 16,
            }}
          >
            {/* Capital working (vaultValue) */}
            <StatCard
              title={t.capitalTitle}
              value={formatUsdc(dash.vaultValue)}
              label={t.capitalLabel}
              sub={t.capitalSub}
            />

            {/* Monthly returns (vaultValue − principal) */}
            <StatCard
              title={t.returnsTitle}
              value={monthlyReturnsFmt}
              label={t.returnsLabel}
              sub={t.returnsSub}
              silver
            />

            {/* Available to spend (spendable) */}
            <StatCard
              title={t.spendableTitle}
              value={formatUsdc(dash.spendable)}
              label={t.spendableLabel}
              sub={t.spendableSub}
            />
          </div>

          {/* ── Returns bar chart (committed vs available) + APY ──────────── */}
          <div
            style={{
              background: '#1A1C1F',
              border: '1px solid #2A2D31',
              borderRadius: 18,
              padding: 26,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#F2F3F4', margin: 0 }}>
                {t.barTitle}
              </h2>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 12.5,
                    color: '#9A9DA1',
                  }}
                >
                  {t.usage(pct)}
                </span>
                {/* APY badge */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 12.5,
                    color: '#C0C2C5',
                    border: '1px solid #2A2D31',
                    borderRadius: 999,
                    padding: '4px 11px',
                  }}
                >
                  {t.apyLabel}: {dash.apyPercent}%
                </span>
              </span>
            </div>
            <div
              style={{
                height: 14,
                borderRadius: 999,
                background: '#16181B',
                border: '1px solid #2A2D31',
                overflow: 'hidden',
                marginTop: 18,
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg,#A8AAAD,#E6E8EA)',
                  borderRadius: 999,
                  transition: 'width .4s cubic-bezier(.2,.65,.2,1)',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)',
                  }}
                />
                <span style={{ fontSize: 13, color: '#9A9DA1' }}>{t.committedLabel}</span>
                <span
                  style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#F2F3F4' }}
                >
                  {committedFmt}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#2A2D31' }} />
                <span style={{ fontSize: 13, color: '#9A9DA1' }}>{t.availableLabel}</span>
                <span
                  style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#F2F3F4' }}
                >
                  {availableFmt}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <span style={{ fontSize: 13, color: '#9A9DA1' }}>{t.totalLabel}</span>
                <span
                  style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#C0C2C5' }}
                >
                  {monthlyReturnsFmt}
                </span>
              </div>
            </div>
          </div>

          {/* ── Deposit CTA card ─────────────────────────────────────────── */}
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid #4a4d52',
              borderRadius: 20,
              background:
                'linear-gradient(135deg,#3c3f44 0%,#26282c 26%,#16181b 52%,#303338 74%,#1b1d21 100%)',
              boxShadow: '0 18px 44px rgba(0,0,0,.4),0 2px 0 rgba(255,255,255,.1) inset',
            }}
          >
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                padding: 26,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 24,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ flex: '1 1 280px' }}>
                <h2
                  style={{
                    fontSize: 19,
                    fontWeight: 700,
                    color: '#F2F3F4',
                    margin: 0,
                    textShadow: '0 1px 0 rgba(0,0,0,.4)',
                  }}
                >
                  {t.depositTitle}
                </h2>
                <p
                  style={{
                    fontSize: 14.5,
                    lineHeight: 1.55,
                    color: '#9A9DA1',
                    margin: '8px 0 0',
                    maxWidth: 360,
                  }}
                >
                  {t.depositSub}
                </p>
                <div style={{ display: 'flex', gap: 9, marginTop: 18, flexWrap: 'wrap' }}>
                  {quickAmounts.map((q) => (
                    <button
                      key={q}
                      onClick={() => router.push('/deposit')}
                      style={{
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: 13,
                        cursor: 'pointer',
                        borderRadius: 999,
                        padding: '9px 15px',
                        border: '1px solid #2A2D31',
                        background: '#16181B',
                        color: '#9A9DA1',
                        transition: 'all .2s ease',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 12.5,
                    color: '#C0C2C5',
                    marginTop: 14,
                  }}
                >
                  {t.estReturn}
                </div>
              </div>
              <div
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  minWidth: 220,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#16181B',
                    border: '1px solid #2A2D31',
                    borderRadius: 12,
                    padding: '13px 15px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 16,
                      color: '#9A9DA1',
                    }}
                  >
                    R$
                  </span>
                  <span
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 18,
                      color: '#F2F3F4',
                      fontWeight: 600,
                    }}
                  >
                    5.000
                  </span>
                </div>
                <button
                  onClick={() => router.push('/deposit')}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#0E0F11',
                    background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)',
                    border: 'none',
                    borderRadius: 12,
                    padding: '14px 22px',
                    cursor: 'pointer',
                    boxShadow:
                      '0 1px 0 rgba(255,255,255,.5) inset,0 8px 22px rgba(0,0,0,.4)',
                    transition: 'transform .25s ease,box-shadow .25s ease,filter .25s ease',
                  }}
                >
                  {t.depositCta}
                </button>
                <div
                  style={{
                    fontSize: 11.5,
                    color: '#7E8186',
                    textAlign: 'center',
                    lineHeight: 1.4,
                  }}
                >
                  {t.depositSecurity}
                </div>
              </div>
            </div>
          </div>

          {/* ── Subscriptions list ───────────────────────────────────────── */}
          <div style={{ marginTop: 6 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '-.015em',
                    color: '#F2F3F4',
                    margin: 0,
                  }}
                >
                  {t.servicesTitle}
                </h2>
                <p style={{ fontSize: 14.5, color: '#9A9DA1', margin: '7px 0 0' }}>
                  {t.servicesSub}
                </p>
              </div>

              {/* Category tabs */}
              <div
                style={{
                  display: 'inline-flex',
                  border: '1px solid #2A2D31',
                  borderRadius: 999,
                  padding: 3,
                  gap: 2,
                  background: '#16181B',
                }}
              >
                {tabOrder.map(({ id, label }) => {
                  const on = tab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      style={{
                        ...tabBase,
                        background: on ? '#2E3136' : 'transparent',
                        color: on ? '#F2F3F4' : '#9A9DA1',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bills management: add form + list + per-bill delete */}
            <div style={{ marginTop: 20 }}>
              <Bills bills={bills} onBillsChanged={handleBillsChanged} tab={tab} />
            </div>
          </div>

          {/* ── Virtual card panel ───────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 24,
              alignItems: 'center',
              background: '#1A1C1F',
              border: '1px solid #2A2D31',
              borderRadius: 20,
              padding: 26,
              marginTop: 6,
            }}
          >
            {/* Brushed VISA card mock */}
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                flex: '0 0 auto',
                width: 340,
                maxWidth: '100%',
                aspectRatio: '1.6',
                borderRadius: 18,
                border: '1px solid #4a4d52',
                background:
                  'linear-gradient(135deg,#3c3f44 0%,#26282c 26%,#16181b 52%,#303338 74%,#1b1d21 100%)',
                boxShadow: '0 24px 56px rgba(0,0,0,.55),0 2px 0 rgba(255,255,255,.1) inset',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      background: 'linear-gradient(135deg,#E6E8EA,#9A9DA1)',
                      transform: 'rotate(45deg)',
                      borderRadius: 2,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 12,
                      letterSpacing: '.18em',
                      color: '#D4D6D9',
                    }}
                  >
                    FIXEARN
                  </span>
                </span>
                <span
                  style={{
                    width: 34,
                    height: 25,
                    borderRadius: 5,
                    background: 'linear-gradient(135deg,#D4D6D9,#8d9094)',
                    boxShadow: '0 1px 2px rgba(0,0,0,.45) inset',
                  }}
                />
              </div>
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 18,
                  letterSpacing: '.18em',
                  color: '#EDEFF1',
                  textShadow: '0 1px 0 rgba(0,0,0,.5)',
                }}
              >
                •••• •••• •••• 4291
              </div>
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 12,
                    letterSpacing: '.1em',
                    color: '#C0C2C5',
                  }}
                >
                  ACME LTDA.
                </span>
                <span
                  style={{
                    fontStyle: 'italic',
                    fontWeight: 700,
                    fontSize: 17,
                    color: '#EDEFF1',
                    letterSpacing: '-.02em',
                  }}
                >
                  VISA
                </span>
              </div>
            </div>

            {/* Paid services list + settings */}
            <div style={{ flex: '1 1 280px', minWidth: 240 }}>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: '#C8CACD', margin: '0 0 16px' }}>
                {t.cardText}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {bills
                  .filter((b) => b.status === 'active')
                  .map((b) => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 0',
                        borderBottom: '1px solid #2A2D31',
                      }}
                    >
                      <span style={{ fontSize: 14, color: '#F2F3F4' }}>{b.vendor}</span>
                      <span
                        style={{
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: 13,
                          color: '#9A9DA1',
                        }}
                      >
                        {formatUsdc(b.monthlyCost)}
                      </span>
                    </div>
                  ))}
              </div>
              <button
                style={{
                  marginTop: 18,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#F2F3F4',
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid #3A3D41',
                  borderRadius: 10,
                  padding: '11px 20px',
                  cursor: 'pointer',
                  transition: 'all .25s ease',
                }}
              >
                {t.cardSettings}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
