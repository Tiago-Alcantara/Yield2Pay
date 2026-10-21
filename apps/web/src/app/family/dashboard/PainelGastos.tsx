'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import type { AccountView, ExpenseCategory, ExpenseView, HouseholdProfile, HouseholdSummary, LessonProgressView, LessonView } from '@yield2pay/shared';
import { LOCAL_DEV_TOKEN } from '../_lib/localSession';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { MetalCard } from '@/components/MetalCard';
import { useIsMobile } from '@/lib/useIsMobile';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';
import { createHouseholdApi } from '../_lib/householdApi';
import { Charts } from './Charts';
import { EMPTY_FILTERS, FilterBar, categoryId, matchesExpense, type ExpenseFilters } from './FilterBar';
import { ImportModal } from './ImportModal';
import { Onboarding } from './Onboarding';
import './painel.css';
import { ContaModal } from '../conta/ContaModal';
import { onLiberdadeChange, readLiberdade } from '../_lib/liberdadePref';
import { lessonsForTrack } from '../aprender/lesson-content';
import { aprenderPath } from '../aprender/player';
import {
  CATEGORY_LABEL,
  DEF,
  brl,
  brl0,
  cap,
  draftFromProfile,
  draftToProfile,
  freedomPhrase,
  lessonTrack,
  mesNome,
  metaLabel,
  nf,
  reais,
  saoPauloDay,
  saoPauloMonth,
  shiftMonth,
  sortMonths,
  type ChartId,
  type PainelDraft,
} from './painel-format';

function IconPainel() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}
function IconGastos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h9" />
    </svg>
  );
}
function IconLiberdade() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.5-2.8 7.4-7 8.5C7.8 19.4 5 16.5 5 12V6l7-3z" />
    </svg>
  );
}
function IconAprender() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6.5 12 3l8 3.5V18l-8 3.5L4 18V6.5z" />
      <path d="M12 6.5V21" />
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

const NAV = [
  { href: '#s-topo', label: 'Painel', icon: <IconPainel /> },
  { href: '#s-gastos', label: 'Gastos', icon: <IconGastos /> },
  { href: '#s-liberdade', label: 'Liberdade', icon: <IconLiberdade /> },
  { href: '/family/aprender', label: 'Aprender', icon: <IconAprender /> },
] as const;

const EMPTY_SUMMARY: HouseholdSummary = {
  monthTotalCents: 0,
  previousComparableCents: 0,
  changePercent: null,
  projectedCents: 0,
  leftoverCents: null,
  byCategory: [],
  lastSixMonths: [],
  averageCents: 0,
  dailyPace: { current: [], previous: [] },
  fixedVsVariable: [],
  freedom: null,
};

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const header = document.getElementById('painel-header');
  const offset = (header?.getBoundingClientRect().height ?? 0) + 12;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
};

/** Mesmo card de indicador do /dashboard. */
function StatCard({
  title,
  value,
  label,
  sub,
  silver = false,
  compact = false,
}: {
  title: string;
  value: string;
  label: string;
  sub: string;
  silver?: boolean;
  compact?: boolean;
}) {
  return (
    <div style={{ background: '#1A1C1F', border: '1px solid #2A2D31', borderRadius: 18, padding: 24 }}>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9DA1' }}>
        {title}
      </div>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: compact ? 26 : 32, fontWeight: 600, color: silver ? '#C0C2C5' : '#F2F3F4', marginTop: 14, letterSpacing: '.01em', lineHeight: 1.15 }}>
        {value}
      </div>
      <div style={{ fontSize: 13.5, color: '#9A9DA1', marginTop: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: '#C0C2C5', marginTop: 6 }}>{sub}</div>
    </div>
  );
}

const iconBadgeStyle: CSSProperties = {
  width: 38,
  height: 38,
  flexShrink: 0,
  borderRadius: 11,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(160deg,#43464b,#1b1d21)',
  border: '1px solid #4a4d52',
  color: '#D4D6D9',
};

type GetToken = () => Promise<string | null>;

export default function PainelGastos() {
  if (!isPrivyConfigured) {
    return <PainelScreen getToken={async () => LOCAL_DEV_TOKEN} />;
  }
  return <PrivyPainel />;
}

function PrivyPainel() {
  const { getAccessToken, logout } = usePrivy();
  return <PainelScreen getToken={getAccessToken} onLogout={() => void logout()} />;
}

function PainelScreen({ getToken, onLogout }: { getToken: GetToken; onLogout?: () => void }) {
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const monthRequest = useRef(0);

  const [phase, setPhase] = useState<'panel' | 'name'>('panel');
  const [account, setAccount] = useState<AccountView | null>(null);
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);
  const [summary, setSummary] = useState<HouseholdSummary>(EMPTY_SUMMARY);
  const [expenses, setExpenses] = useState<ExpenseView[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState(() => saoPauloMonth());
  const [filters, setFilters] = useState<ExpenseFilters>(EMPTY_FILTERS);
  const [lessons, setLessons] = useState<LessonView[]>([]);
  const [progress, setProgress] = useState<LessonProgressView[]>([]);
  const [chart, setChart] = useState<ChartId>('cat');
  const [showAll, setShowAll] = useState(false);
  const [nav, setNav] = useState('#s-topo');
  const [onbOpen, setOnbOpen] = useState(false);
  const [onbKey, setOnbKey] = useState(0);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liberdadeOn, setLiberdadeOn] = useState(true);
  const isMobile = useIsMobile();
  const router = useRouter();

  const api = () => createHouseholdApi(() => getTokenRef.current());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('conta') !== '1') return;
    setSettingsOpen(true);
    params.delete('conta');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, []);

  useEffect(() => {
    const sync = () => setLiberdadeOn(readLiberdade());
    sync();
    return onLiberdadeChange(sync);
  }, []);

  useEffect(() => {
    if (phase !== 'panel') return;
    const id = window.location.hash.replace('#', '');
    if (id.startsWith('s-')) requestAnimationFrame(() => scrollToId(id));
  }, [phase]);

  useEffect(() => {
    document.body.style.overflow = onbOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [onbOpen]);

  useEffect(() => {
    const client = api();
    let cancelled = false;
    (async () => {
      try {
        const accountView = await client.getAccount();
        if (cancelled) return;
        if (!accountView.household) {
          setAccount(accountView);
          setPhase('name');
          return;
        }
        const [profileView, current, monthList] = await Promise.all([
          client.getProfile(),
          client.getCurrentHousehold(),
          client.getExpenseMonths(),
        ]);
        const sorted = sortMonths(monthList);
        const selected = sorted.at(-1) ?? saoPauloMonth();
        const track = lessonTrack(profileView.cryptoExperience);
        const [expenseRows, summaryView, progressRows, lessonRows] = await Promise.all([
          client.getExpenses({ month: selected }),
          client.getHouseholdSummary({ month: selected }),
          client.getLessonProgress(),
          track ? client.getLessons(track) : Promise.resolve([] as LessonView[]),
        ]);
        if (cancelled) return;
        setAccount({
          ...accountView,
          household: {
            ...accountView.household,
            role: current.role,
            onboardingCompleted: current.onboardingCompleted,
          },
        });
        setProfile(profileView);
        setMonths(sorted.length ? sorted : [selected]);
        setMonth(selected);
        setExpenses(expenseRows);
        setSummary(summaryView);
        setProgress(progressRows);
        setLessons(lessonRows);
        setPhase('panel');
        if (!current.onboardingCompleted) setOnbOpen(true);
      } catch {
        if (!cancelled) setPhase('panel');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function pickMonth(next: string) {
    setFilters((current) => (current.mode === 'mes' ? current : { ...current, mode: 'mes' }));
    setShowAll(false);
    if (next === month) return;
    monthRequest.current += 1;
    const request = monthRequest.current;
    setMonth(next);
    const client = api();
    Promise.all([client.getExpenses({ month: next }), client.getHouseholdSummary({ month: next })])
      .then(([expenseRows, summaryView]) => {
        if (monthRequest.current !== request) return;
        setExpenses(expenseRows);
        setSummary(summaryView);
      })
      .catch(() => undefined);
  }

  function pickCat(label: string) {
    const id = categoryId(label);
    setFilters((current) => ({ ...current, cats: id ? [id] : [] }));
    setShowAll(false);
    scrollToId('s-gastos');
  }

  function applyFilters(next: ExpenseFilters, nextMonth: string) {
    setFilters(next);
    setShowAll(false);
    if (next.mode === 'mes' && nextMonth !== month) pickMonth(nextMonth);
  }

  async function refresh(selected: string) {
    const client = api();
    const [expenseRows, summaryView, monthList] = await Promise.all([
      client.getExpenses({ month: selected }),
      client.getHouseholdSummary({ month: selected }),
      client.getExpenseMonths(),
    ]);
    const sorted = sortMonths(monthList);
    setExpenses(expenseRows);
    setSummary(summaryView);
    setMonths(sorted.length ? sorted : [selected]);
  }

  async function importFile(file: File) {
    const result = await api().importStatement(file);
    await refresh(month);
    return result;
  }

  async function undoImport(statementId: string) {
    await api().deleteStatement(statementId);
    await refresh(month);
  }

  async function removeExpense(id: string) {
    await api().deleteExpense(id);
    await refresh(month);
  }

  async function createExpense(body: { merchant: string; amountCents: number; spentOn: string; category: ExpenseCategory }) {
    await api().createExpense(body);
    await refresh(month);
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    try {
      await api().inviteMember(email);
      setInviteEmail('');
    } catch {
      return;
    }
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    const name = groupName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const client = api();
      await client.createHousehold(name);
      const [accountView, profileView] = await Promise.all([client.getAccount(), client.getProfile()]);
      const selected = saoPauloMonth();
      setAccount(accountView);
      setProfile(profileView);
      setMonth(selected);
      setMonths([selected]);
      setExpenses([]);
      setSummary(EMPTY_SUMMARY);
      setLessons([]);
      setProgress([]);
      setPhase('panel');
      setOnbKey((key) => key + 1);
      setOnbOpen(true);
    } catch {
      return;
    } finally {
      setCreating(false);
    }
  }

  async function saveProfile(draft: PainelDraft) {
    const client = api();
    await client.putProfile(draftToProfile(draft));
    const nextProfile = await client.getProfile();
    const nextSummary = await client.getHouseholdSummary({ month });
    const track = lessonTrack(nextProfile.cryptoExperience);
    const lessonRows = track ? await client.getLessons(track) : [];
    setProfile(nextProfile);
    setSummary(nextSummary);
    setLessons(lessonRows);
    setAccount((prev) =>
      prev?.household ? { ...prev, household: { ...prev.household, onboardingCompleted: true } } : prev,
    );
  }

  async function skipOnboarding() {
    try {
      await api().skipProfile();
    } catch {
      return;
    }
    setProfile((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev));
    setAccount((prev) =>
      prev?.household ? { ...prev, household: { ...prev.household, onboardingCompleted: true } } : prev,
    );
    setOnbOpen(false);
  }

  function lessonDone(id: string) {
    return progress.some((row) => row.lessonId === id && row.completed);
  }

  function openLesson(lessonNumber: number) {
    router.push(aprenderPath(lessonNumber));
  }

  async function restartLessons() {
    try {
      await api().deleteLessonProgress();
    } catch {
      return;
    }
    setProgress((prev) => prev.map((row) => ({ ...row, completed: false })));
    openLesson(1);
  }

  async function showInterest() {
    const client = api();
    try {
      await client.patchProfile({ cryptoExperience: 'beginner' });
      setProfile((prev) => (prev ? { ...prev, cryptoExperience: 'beginner' } : prev));
      setLessons(await client.getLessons('beginner'));
    } catch {
      return;
    }
  }

  if (phase === 'name') {
    return (
      <div className="y2p">
        <main className="y2p-main">
          <div className="y2p-body" style={{ maxWidth: 560, flex: 1, justifyContent: 'center' }}>
          <form className="y2p-card" onSubmit={(event) => void createGroup(event)} style={{ flex: '1 1 auto' }}>
            <div className="y2p-eyebrow">Sua casa</div>
            <h1 className="y2p-h2">Como se chama este grupo?</h1>
            <p className="y2p-p" style={{ color: '#9A9DA1' }}>
              O painel de gastos é da casa inteira. Você pode convidar o resto da família depois.
            </p>
            <input
              aria-label="Nome do grupo"
              placeholder="Casa 1"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              style={fieldStyle}
            />
            <button type="submit" className="y2p-chrome y2p-btn-md" disabled={!groupName.trim() || creating} style={{ alignSelf: 'flex-start' }}>
              Continuar
            </button>
          </form>
          </div>
        </main>
      </div>
    );
  }

  const partial = month === saoPauloMonth();
  const mName = mesNome(month);
  const previousName = mesNome(shiftMonth(month, -1));
  const top = summary.byCategory[0];
  const freedom = summary.freedom;
  const goal = profile?.goalMonths;
  const reserveCents = profile?.reserveCents;
  const incomeCents = profile?.monthlyIncomeCents;
  const pessoas = profile ? draftFromProfile(profile).pessoas : null;
  const pct = freedom && goal ? Math.min(100, (freedom.months / goal) * 100) : 0;
  const userName = account?.displayName?.trim() || account?.fullName?.trim().split(/\s+/)[0] || '';
  const userFull = account?.displayName?.trim() || account?.fullName?.trim() || 'Conta família';
  const initials = account?.initials || '?';
  const isOwner = account?.household?.role === 'owner';
  const pills = months.length ? months : [month];
  const totals: Record<string, number> = {};
  for (const row of summary.lastSixMonths) totals[row.month] = row.amountCents;
  totals[month] = summary.monthTotalCents;
  const present = new Set(expenses.map((row) => CATEGORY_LABEL[row.category]));
  for (const id of filters.cats) present.add(CATEGORY_LABEL[id]);
  const chips = ['Todas', ...Object.values(CATEGORY_LABEL).filter((label) => present.has(label))];
  const list = expenses.filter((row) => matchesExpense(row, filters));
  const rows = showAll ? list : list.slice(0, 8);
  const listCents = list.reduce((sum, row) => sum + row.amountCents, 0);
  const track = lessonTrack(profile?.cryptoExperience);
  const presented = track ? lessonsForTrack(track, lessons) : [];
  const doneN = lessons.filter((lesson) => lessonDone(lesson.id)).length;
  const nextLesson = lessons.findIndex((lesson) => !lessonDone(lesson.id));
  const criptoOn = profile?.cryptoExperience !== 'declined';
  const change =
    summary.changePercent == null
      ? 'Primeiro mês importado'
      : (summary.changePercent >= 0 ? '▲ ' : '▼ ') +
        nf(Math.abs(summary.changePercent), Number.isInteger(Math.abs(summary.changePercent)) ? 0 : 1) +
        '% vs. ' +
        previousName +
        (partial ? ' no mesmo período' : '');
  const incomeSub = [
    incomeCents != null ? 'Renda de ' + brl0(reais(incomeCents)) : '',
    partial ? 'projeção ' + brl0(reais(summary.projectedCents)) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const kpis: { label: string; value: string; sub: string; lead?: boolean; text?: boolean }[] = [
    {
      label: partial ? 'Gasto até dia ' + saoPauloDay() : 'Gasto em ' + mName,
      value: brl(reais(summary.monthTotalCents)),
      sub: change,
      lead: true,
    },
    {
      label: partial ? 'Sobra prevista' : 'Sobrou no mês',
      value: summary.leftoverCents == null ? '—' : brl0(reais(summary.leftoverCents)),
      sub: incomeSub,
    },
    {
      label: 'Meses de liberdade',
      value: freedom ? nf(freedom.months, 1) + ' meses' : '—',
      sub: goal ? 'Meta: ' + metaLabel(goal) : 'Meta ainda não definida',
    },
    {
      label: 'Maior categoria',
      value: top ? CATEGORY_LABEL[top.category] : '—',
      sub:
        top && summary.monthTotalCents
          ? brl0(reais(top.amountCents)) + ' · ' + Math.round((top.amountCents / summary.monthTotalCents) * 100) + '% do mês'
          : '',
      text: true,
    },
  ];

  const openOnboarding = () => {
    setOnbKey((key) => key + 1);
    setOnbOpen(true);
  };

  return (
    <div
      className="y2p"
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
      <aside
        data-screen-label="Menu"
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
        <a
          href="/family/dashboard"
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
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', color: '#F2F3F4' }}>Yield2Pay</span>
        </a>
        <nav style={isMobile ? {
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
          overflowX: 'auto',
          paddingBottom: 4,
        } : { display: 'flex', flexDirection: 'column', gap: 3 }}>
          {NAV.filter((item) => (item.href !== '/family/aprender' || profile?.cryptoExperience !== 'declined') && (item.href !== '#s-liberdade' || liberdadeOn)).map((item) => {
            const on = nav === item.href;
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  if (item.href.startsWith('/')) {
                    router.push(item.href);
                    return;
                  }
                  setNav(item.href);
                  scrollToId(item.href.slice(1));
                }}
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
                  <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: '0 3px 3px 0', background: on ? '#C0C2C5' : 'transparent' }} />
                )}
                <span style={{ display: 'flex', color: on ? '#F2F3F4' : '#9A9DA1' }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        {!isMobile && (
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 11, padding: '12px 10px', borderTop: '1px solid #2A2D31' }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(160deg,#43464b,#1b1d21)', border: '1px solid #4a4d52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: '#D4D6D9' }}>
              {initials}
            </span>
            <button type="button" onClick={() => setSettingsOpen(true)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#F2F3F4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userFull}</span>
              <span style={{ display: 'block', fontFamily: "'Geist Mono', monospace", fontSize: 10.5, color: '#9A9DA1' }}>Conta família</span>
            </button>
            {onLogout && (
              <button type="button" aria-label="Sair" onClick={onLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9DA1', display: 'flex', padding: 4 }}>
                <IconLogout />
              </button>
            )}
          </div>
        )}
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          id="painel-header"
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
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, letterSpacing: '-.015em', color: '#F2F3F4' }}>
              {userName ? 'Olá, ' + userName : 'Painel da família'}
            </div>
            {!isMobile && (
              <div style={{ fontSize: 13.5, color: '#9A9DA1', marginTop: 2 }}>
                {partial ? cap(mName) + ' até agora' : 'Como foi ' + mName}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <FilterBar
              month={month}
              months={pills}
              totals={totals}
              expenses={expenses}
              filters={filters}
              onFilters={setFilters}
              onMonth={pickMonth}
              onApply={applyFilters}
            />
            <button type="button" aria-label="Configurações" onClick={() => setSettingsOpen(true)} style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(160deg,#43464b,#1b1d21)', border: '1px solid #4a4d52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: '#D4D6D9', cursor: 'pointer', padding: 0 }}>
              {initials}
            </button>
          </div>
        </header>

        <div
          id="s-topo"
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
          <MetalCard padding={28} radius="var(--fx-radius-xl)">
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 184 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={iconBadgeStyle}><IconGastos /></span>
                <span style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--fx-text-3)' }}>{kpis[0].label}</span>
              </div>
              <div style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 34, fontWeight: 600, marginTop: 18, letterSpacing: 'var(--fx-tracking-data)', lineHeight: 1.05, color: 'var(--fx-text-strong)' }}>{kpis[0].value}</div>
              <div style={{ marginTop: 8, fontSize: 13.5, color: 'var(--fx-text-3)' }}>{kpis[0].sub}</div>
              <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                <Button variant="primary" size="sm" onClick={() => setImportOpen(true)}>Importar extrato</Button>
              </div>
            </div>
          </MetalCard>
          {liberdadeOn && <MetalCard padding={28} radius="var(--fx-radius-xl)">
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 184 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={iconBadgeStyle}><IconLiberdade /></span>
                <span style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--fx-text-3)' }}>Liberdade</span>
              </div>
              <div style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 34, fontWeight: 600, marginTop: 18, letterSpacing: 'var(--fx-tracking-data)', lineHeight: 1.05, color: 'var(--fx-silver-bright)' }}>{kpis[2].value}</div>
              <div style={{ marginTop: 8, minHeight: 22, display: 'flex', alignItems: 'center' }}>
                <Badge dot>{goal ? 'Meta ' + metaLabel(goal) : 'Meta em aberto'}</Badge>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                <Button variant="secondary" size="sm" onClick={() => scrollToId('s-liberdade')}>Ver liberdade</Button>
              </div>
            </div>
          </MetalCard>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          <StatCard title={kpis[1].label} value={kpis[1].value} label="Depois da renda da casa" sub={kpis[1].sub || 'Renda ainda não informada'} />
          <StatCard title="Gasto médio" value={brl0(reais(summary.averageCents))} label="Meses já fechados" sub={partial ? 'Projeção ' + brl0(reais(summary.projectedCents)) : 'Base da reserva'} silver />
          <StatCard title={kpis[3].label} value={kpis[3].value} label="Onde mais saiu neste mês" sub={kpis[3].sub || 'Sem gastos no mês'} compact />
        </div>

        <div style={{ background: '#1A1C1F', border: '1px solid #2A2D31', borderRadius: 18, padding: 26 }}>
          <Charts month={month} chart={chart} summary={summary} onChart={setChart} onPickMonth={pickMonth} onPickCat={pickCat} />
        </div>

        {liberdadeOn && <div id="s-liberdade" data-screen-label="Liberdade" style={{ background: '#1A1C1F', border: '1px solid #2A2D31', borderRadius: 18, padding: 26 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#F2F3F4', margin: 0 }}>Liberdade da família</h2>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: '#9A9DA1' }}>
              {goal ? 'Você está em ' + Math.round(pct) + '% da meta' : 'Meta ainda não definida'}
            </span>
          </div>
          <div style={{ height: 14, borderRadius: 999, background: '#16181B', border: '1px solid #2A2D31', overflow: 'hidden', marginTop: 18, display: 'flex' }}>
            <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg,#A8AAAD,#E6E8EA)', borderRadius: 999 }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)' }} />
              <span style={{ fontSize: 13, color: '#9A9DA1' }}>Hoje</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#F2F3F4' }}>{freedom ? nf(freedom.months, 1) + ' meses' : '—'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#2A2D31' }} />
              <span style={{ fontSize: 13, color: '#9A9DA1' }}>Meta</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#F2F3F4' }}>{goal ? metaLabel(goal) : '—'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span style={{ fontSize: 13, color: '#9A9DA1' }}>Faltam</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#C0C2C5' }}>{freedom ? brl0(reais(Math.max(0, freedom.missingCents))) : '—'}</span>
            </div>
          </div>
        </div>}

        {liberdadeOn && <div style={{ position: 'relative', overflow: 'hidden', border: '1px solid #4a4d52', borderRadius: 20, background: 'linear-gradient(135deg,#3c3f44 0%,#26282c 26%,#16181b 52%,#303338 74%,#1b1d21 100%)', boxShadow: '0 18px 44px rgba(0,0,0,.4),0 2px 0 rgba(255,255,255,.1) inset' }}>
          <div style={{ position: 'relative', zIndex: 2, padding: 26, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: '1 1 280px' }}>
              <h2 style={{ fontSize: 19, fontWeight: 700, color: '#F2F3F4', margin: 0 }}>A reserva sustenta a casa</h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: '#9A9DA1', margin: '8px 0 0', maxWidth: 420 }}>
                Se a renda parasse hoje, a reserva de {reserveCents != null ? brl0(reais(reserveCents)) : '—'} cobre {freedom ? nf(freedom.months, 1) + ' meses' : '—'} de gastos. {freedomPhrase(freedom)}
              </p>
              {profile && profile.priorities.length > 0 && (
                <div style={{ display: 'flex', gap: 9, marginTop: 18, flexWrap: 'wrap' }}>
                  {profile.priorities.map((item) => (
                    <span key={item} style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, borderRadius: 999, padding: '9px 15px', border: '1px solid #2A2D31', background: '#16181B', color: '#9A9DA1' }}>{item}</span>
                  ))}
                </div>
              )}
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: '#C0C2C5', marginTop: 14 }}>
                {(pessoas || 'Família') + ' · renda ' + (incomeCents != null ? brl0(reais(incomeCents)) : '—') + '/mês'}
              </div>
            </div>
            <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#16181B', border: '1px solid #2A2D31', borderRadius: 12, padding: '13px 15px' }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 18, color: '#F2F3F4', fontWeight: 600 }}>{freedom ? nf(freedom.months, 1) : '—'}</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#9A9DA1' }}>meses</span>
              </div>
              <button
                type="button"
                onClick={openOnboarding}
                style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: '#0E0F11', background: 'linear-gradient(180deg,#E6E8EA,#A8AAAD)', border: 'none', borderRadius: 12, padding: '14px 22px', cursor: 'pointer', boxShadow: '0 1px 0 rgba(255,255,255,.5) inset,0 8px 22px rgba(0,0,0,.4)' }}
              >
                Editar respostas
              </button>
              <div style={{ fontSize: 11.5, color: '#7E8186', textAlign: 'center', lineHeight: 1.4 }}>Gasto médio {brl0(reais(summary.averageCents))}</div>
            </div>
          </div>
        </div>}

        <div id="s-gastos" data-screen-label="Gastos" style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.015em', color: '#F2F3F4', margin: 0 }}>{filters.mode === 'custom' ? 'Gastos do período' : 'Gastos de ' + mName}</h2>
              <p style={{ fontSize: 14.5, color: '#9A9DA1', margin: '7px 0 0' }}>
                {list.length + (list.length === 1 ? ' gasto' : ' gastos') + ' · ' + brl(reais(listCents))}
              </p>
            </div>
            <div className="y2p-chips">
                {chips.map((label) => {
                  const id = categoryId(label);
                  const on = label === 'Todas' ? filters.cats.length === 0 : id != null && filters.cats.includes(id);
                  return (
                    <button
                      key={label}
                      type="button"
                      className={'y2p-chip' + (on ? ' is-on' : '')}
                      onClick={() => {
                        if (!id) setFilters((current) => ({ ...current, cats: [] }));
                        else setFilters((current) => ({ ...current, cats: current.cats.length === 1 && current.cats[0] === id ? [] : [id] }));
                        setShowAll(false);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          <div className="y2p-list" style={{ marginTop: 20, background: '#1A1C1F', border: '1px solid #2A2D31', borderRadius: 18 }}>
            {rows.map((row) => (
              <div key={row.id} className="y2p-tx">
                <span className="y2p-mono" style={{ fontSize: 13, color: '#9A9DA1' }}>
                  {row.date.slice(8, 10) + '/' + row.date.slice(5, 7)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="y2p-ellipsis">{row.merchant}</span>
                    {row.fixed && <span className="y2p-mono y2p-fixo">fixo</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: '#9A9DA1', marginTop: 2 }}>{row.addedBy.displayName}</span>
                </span>
                <span className="y2p-mono y2p-cat">{CATEGORY_LABEL[row.category]}</span>
                <span className="y2p-mono" style={{ color: '#F2F3F4', textAlign: 'right', minWidth: 92 }}>
                  {brl(reais(row.amountCents))}
                </span>
                <button
                  type="button"
                  className="y2p-tx-delete"
                  aria-label={'Apagar ' + row.merchant}
                  onClick={() => void removeExpense(row.id)}
                >
                  Apagar
                </button>
              </div>
            ))}
            {list.length > 8 && (
              <button type="button" className="y2p-more" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Mostrar menos' : 'Ver todos os ' + list.length + ' gastos'}
              </button>
            )}
          </div>
        </div>

        <div
          id="s-aprender"
          data-screen-label="Aprender"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', background: '#1A1C1F', border: '1px solid #2A2D31', borderRadius: 20, padding: 26, marginTop: 6 }}
        >
          <div style={{ flex: '1 1 280px', minWidth: 240 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#F2F3F4', margin: 0 }}>
              {criptoOn ? (profile?.cryptoExperience === 'fund' ? 'Cripto, um passo além' : 'Cripto do zero') : 'Quando fizer sentido'}
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#C8CACD', margin: '12px 0 0' }}>
              {criptoOn
                ? 'Aulas curtas para entender como cripto pode, ou não, entrar no plano de liberdade da família.'
                : 'Preparamos uma trilha curta e sem jargão sobre cripto e liberdade financeira. Fica aqui para quando você quiser.'}
            </p>
            {criptoOn ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontFamily: "'Geist Mono', monospace", fontSize: 12, color: '#9A9DA1' }}>
                  <span>{doneN} de {lessons.length} aulas</span>
                  <span>{lessons.length ? Math.round((doneN / lessons.length) * 100) : 0}%</span>
                </div>
                <div className="y2p-track" style={{ marginTop: 8 }}>
                  <span style={{ width: (lessons.length ? (doneN / lessons.length) * 100 : 0) + '%' }} />
                </div>
                {lessons.length > 0 && (
                  <button type="button" onClick={() => (doneN === lessons.length ? void restartLessons() : openLesson(doneN === 0 ? 1 : nextLesson + 1))} style={{ marginTop: 18, fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: '#F2F3F4', background: 'rgba(255,255,255,.03)', border: '1px solid #3A3D41', borderRadius: 10, padding: '11px 20px', cursor: 'pointer' }}>
                    {doneN === lessons.length ? 'Trilha concluída · recomeçar' : doneN === 0 ? 'Começar aula 1' : 'Continuar · aula ' + (nextLesson + 1)}
                  </button>
                )}
              </>
            ) : (
              <button type="button" onClick={() => void showInterest()} style={{ marginTop: 18, fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: '#F2F3F4', background: 'rgba(255,255,255,.03)', border: '1px solid #3A3D41', borderRadius: 10, padding: '11px 20px', cursor: 'pointer' }}>
                Tenho interesse
              </button>
            )}
          </div>
          {criptoOn && (
            <div style={{ flex: '1 1 280px', minWidth: 240 }}>
              {lessons.map((lesson, index) => (
                <button key={lesson.id} type="button" onClick={() => openLesson(index + 1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12, padding: '9px 0', border: 'none', borderBottom: '1px solid #2A2D31', background: 'none', textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {lessonDone(lesson.id) ? <span className="y2p-check is-done">✓</span> : <span className="y2p-check y2p-mono">{index + 1}</span>}
                    <span style={{ fontSize: 14, color: '#F2F3F4' }}>{presented[index]?.title ?? lesson.title}</span>
                  </span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: '#9A9DA1' }}>{lesson.durationMinutes} min</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {isOwner && (
          <form onSubmit={(event) => void onInvite(event)} style={{ background: '#1A1C1F', border: '1px solid #2A2D31', borderRadius: 18, padding: 26, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <label htmlFor="y2p-invite" style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9A9DA1' }}>Convidar</span>
              <input id="y2p-invite" type="email" value={inviteEmail} placeholder="email@familia.com" onChange={(event) => setInviteEmail(event.target.value)} style={fieldStyle} />
            </label>
            <Button variant="secondary" size="sm" type="submit">Enviar convite</Button>
          </form>
        )}
        </div>
      </main>

      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImportFile={importFile}
          onUndoImport={undoImport}
          onCreateExpense={createExpense}
          onDone={() => {
            setImportOpen(false);
            scrollToId('s-gastos');
          }}
        />
      )}

      <ContaModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        getToken={getToken}
        onLogout={onLogout}
        onAccount={(next) => setAccount((prev) => (
          prev?.household && next.household
            ? { ...next, household: { ...next.household, role: prev.household.role, onboardingCompleted: prev.household.onboardingCompleted } }
            : next
        ))}
        onProfile={(next) => {
          setProfile(next);
          const nextTrack = lessonTrack(next.cryptoExperience);
          if (!nextTrack) {
            setLessons([]);
            return;
          }
          void api().getLessons(nextTrack).then(setLessons).catch(() => undefined);
        }}
        onLeft={() => {
          setAccount((prev) => (prev ? { ...prev, household: null } : prev));
          setPhase('name');
        }}
        onExpensesCleared={() => { void refresh(month); }}
      />

      {onbOpen && (
        <Onboarding
          key={onbKey}
          initial={profile ? draftFromProfile(profile) : DEF}
          summary={summary}
          onSkip={() => void skipOnboarding()}
          onSave={saveProfile}
          onFinish={() => {
            setOnbOpen(false);
            window.scrollTo(0, 0);
          }}
        />
      )}
    </div>
  );
}

const fieldStyle: CSSProperties = {
  width: '100%',
  background: '#0E0F11',
  border: '1px solid #2A2D31',
  borderRadius: 12,
  padding: '12px 14px',
  color: '#F2F3F4',
  fontFamily: 'inherit',
  fontSize: 14,
  outline: 'none',
};
