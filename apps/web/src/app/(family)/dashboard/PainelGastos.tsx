'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import type { AccountView, CompleteOnboarding, ExpenseCategory, ExpenseView, HouseholdProfile, HouseholdSummary, LessonProgressView, LessonView, MonthTotal } from '@yield2pay/shared';
import { LOCAL_DEV_TOKEN } from '../_lib/localSession';
import { Button } from '@/components/Button';
import { MetalCard } from '@/components/MetalCard';
import { useIsMobile } from '@/lib/useIsMobile';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';
import { createHouseholdApi } from '../_lib/householdApi';
import { setAccountView } from '../_lib/accountStore';
import { Charts } from './Charts';
import { EMPTY_FILTERS, FilterBar, categoryId, matchesExpense, type ExpenseFilters } from './FilterBar';
import { ImportModal } from './ImportModal';
import { Onboarding } from './Onboarding';
import './painel.css';
import { ContaModal } from '../conta/ContaModal';
import { onLiberdadeChange, readLiberdade, writeLiberdade } from '../_lib/liberdadePref';
import { draftFromSaved } from './onboarding-model';
import { lessonsForTrack } from '../aprender/lesson-content';
import { aprenderPath } from '../aprender/player';
import {
  CATEGORY_LABEL,
  brl,
  brl0,
  cap,
  libertySentence,
  lessonTrack,
  daysInMonth,
  mesNome,
  metaLabel,
  nf,
  openingMonth,
  reais,
  saoPauloDay,
  saoPauloMonth,
  saoPauloToday,
  shiftMonth,
  sortMonths,
  type ChartId,
} from './painel-format';

function spanEnd(months: string[]) {
  const today = saoPauloToday();
  if (months.length === 0) return today;
  const last = months[months.length - 1];
  const end = `${last}-${String(daysInMonth(last)).padStart(2, '0')}`;
  return end > today ? end : today;
}

async function loadSpan(client: ReturnType<typeof createHouseholdApi>, months: string[]) {
  if (months.length === 0) return [] as ExpenseView[];
  return client.getExpenses({ from: `${months[0]}-01`, to: spanEnd(months) });
}

function categoriesOf(rows: ExpenseView[]) {
  const totals = new Map<ExpenseCategory, number>();
  for (const row of rows) totals.set(row.category, (totals.get(row.category) ?? 0) + row.amountCents);
  return [...totals.entries()]
    .filter(([, amountCents]) => amountCents > 0)
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((left, right) => right.amountCents - left.amountCents);
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
function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M6.5 7l.7 12.2a1 1 0 0 0 1 .8h7.6a1 1 0 0 0 1-.8L18.5 7" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

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
    <div style={{ background: 'var(--fam-card, #1A1C1F)', border: '1px solid var(--fx-border, #2A2D31)', borderRadius: 18, padding: 24 }}>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fx-text-2, #9A9DA1)' }}>
        {title}
      </div>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: compact ? 26 : 32, fontWeight: 600, color: silver ? 'var(--fx-silver, #C0C2C5)' : 'var(--fx-text-strong, #F2F3F4)', marginTop: 14, letterSpacing: '.01em', lineHeight: 1.15 }}>
        {value}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--fx-text-2, #9A9DA1)', marginTop: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--fx-silver, #C0C2C5)', marginTop: 6 }}>{sub}</div>
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
  border: '1px solid var(--fx-border-metal, #4a4d52)',
  color: 'var(--fx-silver-bright, #D4D6D9)',
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

  const [phase, setPhase] = useState<'panel' | 'name' | 'onboarding'>('panel');
  const [account, setAccount] = useState<AccountView | null>(null);
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);
  const [summary, setSummary] = useState<HouseholdSummary>(EMPTY_SUMMARY);
  const [expenses, setExpenses] = useState<ExpenseView[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [monthTotals, setMonthTotals] = useState<MonthTotal[]>([]);
  const [month, setMonth] = useState(() => saoPauloMonth());
  const [filters, setFilters] = useState<ExpenseFilters>(EMPTY_FILTERS);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [inviteOk, setInviteOk] = useState('');
  const [lessons, setLessons] = useState<LessonView[]>([]);
  const [progress, setProgress] = useState<LessonProgressView[]>([]);
  const [chart, setChart] = useState<ChartId>('cat');
  const [showAll, setShowAll] = useState(false);
  const [onbOpen, setOnbOpen] = useState(false);
  const [onbKey, setOnbKey] = useState(0);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importManual, setImportManual] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liberdadeOn, setLiberdadeOn] = useState(true);
  const [summaryState, setSummaryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const isMobile = useIsMobile();
  const router = useRouter();

  const api = () => createHouseholdApi(() => getTokenRef.current());

  // A doca mostra o nome e a família da conta carregada aqui.
  useEffect(() => {
    if (account) setAccountView(account);
  }, [account]);

  // Ações rápidas da doca chegam como ?acao=importar|novo|convidar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const acao = params.get('acao');
    if (!acao) return;
    requestAnimationFrame(() => {
      if (acao === 'importar' || acao === 'novo') {
        setImportManual(acao === 'novo');
        setImportOpen(true);
      } else if (acao === 'convidar') {
        scrollToId('s-convidar');
      }
    });
    params.delete('acao');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('conta') !== '1') return;
    setSettingsOpen(true);
    params.delete('conta');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, []);

  useEffect(() => {
    if (!profile) {
      setLiberdadeOn(readLiberdade());
      return;
    }
    const on = profile.showFreedom !== false;
    setLiberdadeOn(on);
    writeLiberdade(on);
  }, [profile]);

  useEffect(() => onLiberdadeChange(() => setLiberdadeOn(readLiberdade())), []);

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
          setPhase('onboarding');
          return;
        }
        const [profileView, current, monthList] = await Promise.all([
          client.getProfile(),
          client.getCurrentHousehold(),
          client.getExpenseMonths(),
        ]);
        const sorted = sortMonths(monthList.map((row) => row.month));
        const selected = openingMonth(sorted);
        const track = lessonTrack(profileView.cryptoExperience);
        const [expenseRows, summaryView, progressRows, lessonRows] = await Promise.all([
          loadSpan(client, sorted),
          client.getHouseholdSummary({ month: selected }),
          client.getLessonProgress().catch(() => [] as LessonProgressView[]),
          track ? client.getLessons(track).catch(() => [] as LessonView[]) : Promise.resolve([] as LessonView[]),
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
        setMonthTotals(monthList);
        setMonths(sorted.includes(selected) ? sorted : [...sorted, selected].sort());
        setMonth(selected);
        setExpenses(expenseRows);
        setSummary(summaryView);
        setProgress(progressRows);
        setLessons(lessonRows);
        setSummaryState('ready');
        setPhase('panel');
        if (!current.onboardingCompleted) setOnbOpen(true);
      } catch {
        if (!cancelled) {
          setSummaryState('error');
          setPhase('panel');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  function pickMonth(next: string) {
    setFilters((current) => (current.mode === 'mes' ? current : { ...current, mode: 'mes' }));
    setShowAll(false);
    if (next === month) return;
    monthRequest.current += 1;
    const request = monthRequest.current;
    setMonth(next);
    setConfirmId(null);
    api().getHouseholdSummary({ month: next })
      .then((summaryView) => {
        if (monthRequest.current !== request) return;
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
    const monthList = await client.getExpenseMonths();
    const sorted = sortMonths(monthList.map((row) => row.month));
    const [expenseRows, summaryView] = await Promise.all([
      loadSpan(client, sorted.length ? sorted : [selected]),
      client.getHouseholdSummary({ month: selected }),
    ]);
    setExpenses(expenseRows);
    setSummary(summaryView);
    setMonthTotals(monthList);
    setMonths(sorted.includes(selected) ? sorted : [...sorted, selected].sort());
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
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    await api().deleteExpense(id);
    await refresh(month);
  }

  async function changeCategory(id: string, category: ExpenseCategory) {
    const updated = await api().patchExpense(id, { category });
    setExpenses((rows) => rows.map((row) => (row.id === id ? { ...row, category: updated.category } : row)));
    setSummary(await api().getHouseholdSummary({ month }));
  }

  async function createExpense(body: { merchant: string; amountCents: number; spentOn: string; category: ExpenseCategory }) {
    await api().createExpense(body);
    await refresh(month);
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!email) {
      setInviteOk('');
      setInviteError('Informe o e-mail de quem vai entrar na casa.');
      return;
    }
    try {
      await api().inviteMember(email);
      setInviteEmail('');
      setInviteError('');
      setInviteOk('Convite enviado.');
    } catch {
      setInviteOk('');
      setInviteError('Não conseguimos enviar o convite.');
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
      setSummaryState('ready');
      setPhase('panel');
      setOnbKey((key) => key + 1);
      setOnbOpen(true);
    } catch {
      return;
    } finally {
      setCreating(false);
    }
  }

  async function saveOnboarding(body: CompleteOnboarding) {
    const client = api();
    if (!account?.household) {
      const houseName = (body.displayName || body.fullName || 'Minha casa').trim().slice(0, 32) || 'Minha casa';
      try {
        await client.createHousehold(houseName);
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status !== 409) throw error;
      }
    }
    const nextAccount = await client.completeOnboarding(body);
    const nextProfile = await client.getProfile();
    const nextSummary = await client.getHouseholdSummary({ month });
    const track = lessonTrack(nextProfile.cryptoExperience);
    const lessonRows = track ? await client.getLessons(track) : [];
    setAccount(nextAccount);
    setProfile(nextProfile);
    setSummary(nextSummary);
    setLessons(lessonRows);
    writeLiberdade(nextProfile.showFreedom !== false);
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

  if (phase === 'onboarding') {
    return (
      <Onboarding
        onSave={saveOnboarding}
        onFinish={() => {
          setPhase('panel');
          setLoadAttempt((attempt) => attempt + 1);
        }}
      />
    );
  }

  if (phase === 'name') {
    return (
      <div className="y2p">
        <main className="y2p-main">
          <div className="y2p-body" style={{ maxWidth: 560, flex: 1, justifyContent: 'center' }}>
          <form className="y2p-card" onSubmit={(event) => void createGroup(event)} style={{ flex: '1 1 auto' }}>
            <div className="y2p-eyebrow">Sua casa</div>
            <h1 className="y2p-h2">Como se chama este grupo?</h1>
            <p className="y2p-p" style={{ color: 'var(--fx-text-2, #9A9DA1)' }}>
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

  const todayMonth = saoPauloMonth();
  const today = saoPauloToday();
  const partial = month === todayMonth;
  const upcoming = month > todayMonth;
  const mName = mesNome(month);
  const previousName = mesNome(shiftMonth(month, -1));
  const freedom = summary.freedom;
  const goal = profile?.goalMonths;
  const reserveCents = profile?.reserveCents;
  const incomeCents = profile?.monthlyIncomeCents;
  const pctReal = freedom && goal ? Math.round((freedom.months / goal) * 100) : null;
  const barPct = pctReal == null ? 0 : Math.min(100, pctReal);
  const statusLabel = pctReal == null ? 'Meta em aberto' : pctReal >= 100 ? 'Meta alcançada' : 'Em andamento';
  const sentence = libertySentence(freedom, reserveCents, goal);
  const userName = account?.displayName?.trim() || account?.fullName?.trim().split(/\s+/)[0] || '';
  const initials = account?.initials || '?';
  const isOwner = account?.household?.role === 'owner';
  const pills = months.length ? months : [month];
  const totals: Record<string, number> = {};
  for (const row of monthTotals) totals[row.month] = row.amountCents;
  if (partial) totals[month] = summary.monthTotalCents;
  const present = new Set(expenses.map((row) => CATEGORY_LABEL[row.category]));
  for (const id of filters.cats) present.add(CATEGORY_LABEL[id]);
  const chips = ['Todas', ...Object.values(CATEGORY_LABEL).filter((label) => present.has(label))];
  const futureHidden = filters.mode !== 'custom' && partial
    ? expenses.filter((row) => row.date.slice(0, 7) === month && row.date > today).length
    : 0;
  const list = expenses.filter((row) => {
    if (filters.mode !== 'custom' && partial && row.date > today) return false;
    return matchesExpense(row, filters, filters.mode === 'custom' ? undefined : month);
  });
  const rows = showAll ? list : list.slice(0, 8);
  const listCents = list.reduce((sum, row) => sum + row.amountCents, 0);
  const narrowed = filters.mode === 'custom' || filters.cats.length > 0 || filters.tipo !== 'todos' || filters.min !== '' || filters.max !== '' || filters.q.trim() !== '';
  const viewCategories = narrowed ? categoriesOf(list) : summary.byCategory;
  const viewTotal = narrowed ? listCents : summary.monthTotalCents;
  const top = viewCategories[0];
  const viewSummary = narrowed
    ? {
        ...summary,
        monthTotalCents: viewTotal,
        byCategory: viewCategories,
        projectedCents: viewTotal,
        leftoverCents: incomeCents == null ? null : incomeCents - viewTotal,
      }
    : summary;
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
      label: upcoming ? 'Gastos lançados em ' + mName : partial ? 'Gasto até dia ' + saoPauloDay() : 'Gasto em ' + mName,
      value: summaryState === 'ready' ? brl(reais(viewTotal)) : '—',
      sub: summaryState === 'error' ? 'Não foi possível carregar os gastos.' : summaryState === 'loading' ? 'Carregando os gastos…' : narrowed ? 'Só o que o filtro mostra' : change,
      lead: true,
    },
    {
      label: upcoming ? 'Mês ainda não começou' : partial ? 'Sobra prevista' : 'Sobrou no mês',
      value: upcoming ? '—' : summary.leftoverCents == null ? '—' : brl0(reais(narrowed ? viewSummary.leftoverCents ?? 0 : summary.leftoverCents)),
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
        top && viewTotal
          ? brl0(reais(top.amountCents)) + ' · ' + Math.round((top.amountCents / viewTotal) * 100) + '% do mês'
          : '',
      text: true,
    },
  ];

  return (
    <div
      className="y2p"
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        minHeight: '100vh',
        background: 'var(--fam-page, #0E0F11)',
        color: 'var(--fx-text-strong, #F2F3F4)',
        fontFamily: "'Hanken Grotesk', system-ui, -apple-system, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', paddingBottom: 130 }}>
        <header
          id="painel-header"
          className="y2p-header"
          style={{
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            flexDirection: isMobile ? 'column' : 'row',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            gap: isMobile ? 10 : 16,
            padding: isMobile ? '12px 16px' : '20px 32px',
            borderBottom: '1px solid var(--fx-border, #2A2D31)',
            position: 'sticky',
            top: 0,
            background: 'var(--fam-header-bg, rgba(14,15,17,.82))',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            zIndex: 10,
          }}
        >
          <div className="y2p-header-greet" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: isMobile ? '100%' : undefined, minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--fx-text-strong, #F2F3F4)' }}>
                {userName ? 'Olá, ' + userName : 'Painel da família'}
              </div>
              {!isMobile && (
                <div style={{ fontSize: 13.5, color: 'var(--fx-text-2, #9A9DA1)', marginTop: 2 }}>
                  {upcoming ? cap(mName) + ' ainda não começou' : partial ? cap(mName) + ' até agora' : 'Como foi ' + mName}
                </div>
              )}
            </div>
            {isMobile && (
              <button type="button" aria-label="Configurações" onClick={() => setSettingsOpen(true)} style={{ flex: 'none', width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(160deg,#43464b,#1b1d21)', border: '1px solid var(--fx-border-metal, #4a4d52)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--fx-silver-bright, #D4D6D9)', cursor: 'pointer', padding: 0 }}>
                {initials}
              </button>
            )}
          </div>
          <div className="y2p-header-actions" style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, width: isMobile ? '100%' : undefined, minWidth: 0 }}>
            <div style={{ flex: isMobile ? 1 : undefined, minWidth: 0, width: isMobile ? '100%' : undefined }}>
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
            </div>
            {!isMobile && (
              <button type="button" aria-label="Configurações" onClick={() => setSettingsOpen(true)} style={{ flex: 'none', width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(160deg,#43464b,#1b1d21)', border: '1px solid var(--fx-border-metal, #4a4d52)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--fx-silver-bright, #D4D6D9)', cursor: 'pointer', padding: 0 }}>
                {initials}
              </button>
            )}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, alignItems: 'start' }}>
          <MetalCard padding={28} radius="var(--fx-radius-xl)">
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 184 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={iconBadgeStyle}><IconGastos /></span>
                <span style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--fx-text-3)' }}>{kpis[0].label}</span>
              </div>
              <div style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 34, fontWeight: 600, marginTop: 18, letterSpacing: 'var(--fx-tracking-data)', lineHeight: 1.05, color: 'var(--fx-text-strong)' }}>{kpis[0].value}</div>
              <div role={summaryState === 'error' ? 'alert' : undefined} style={{ marginTop: 8, fontSize: 13.5, color: 'var(--fx-text-3)' }}>{kpis[0].sub}</div>
              <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button variant="primary" size="sm" onClick={() => { setImportManual(false); setImportOpen(true); }}>Importar extrato</Button>
                {summaryState === 'error' && (
                  <Button variant="secondary" size="sm" onClick={() => { setSummaryState('loading'); setLoadAttempt((attempt) => attempt + 1); }}>Tentar de novo</Button>
                )}
              </div>
            </div>
          </MetalCard>
          {liberdadeOn && (
            <MetalCard id="s-liberdade" data-screen-label="Liberdade" padding={28} radius="var(--fx-radius-xl)" aria-label="Liberdade da família">
              <div className="y2p-lib-card">
                <div className="y2p-lib-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span style={iconBadgeStyle}><IconLiberdade /></span>
                    <span style={{ fontFamily: 'var(--fx-font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--fx-text-3)' }}>Liberdade</span>
                  </div>
                  <span className="y2p-lib-badge">{statusLabel}</span>
                </div>
                <div className="y2p-lib-hero">
                  <b>{pctReal == null ? '—' : pctReal + '%'}</b>
                  <span>percentual de liberdade</span>
                  {freedom && <em>{nf(freedom.months, 1)} meses</em>}
                </div>
                <p className="y2p-lib-sent">{sentence}</p>
                <div>
                  <div className="y2p-lib-bar" aria-hidden="true"><i style={{ width: barPct + '%' }} /></div>
                  <div className="y2p-lib-legend">
                    <span>Hoje</span>
                    <span>Meta <b className="y2p-mono">{goal ? metaLabel(goal) : '—'}</b></span>
                    <span>Faltam <b className="y2p-mono">{freedom ? brl0(reais(Math.max(0, freedom.missingCents))) : '—'}</b></span>
                  </div>
                </div>
              </div>
            </MetalCard>
          )}
        </div>

        {summaryState === 'ready' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          <StatCard title={kpis[1].label} value={kpis[1].value} label="Depois da renda da casa" sub={kpis[1].sub || 'Renda ainda não informada'} />
          <StatCard title="Gasto médio" value={brl0(reais(summary.averageCents))} label="Meses já fechados" sub={partial ? 'Projeção ' + brl0(reais(summary.projectedCents)) : 'Base da reserva'} silver />
          <StatCard title={kpis[3].label} value={kpis[3].value} label="Onde mais saiu neste mês" sub={kpis[3].sub || 'Sem gastos no mês'} compact />
        </div>
        )}

        {summaryState === 'ready' && (
        <div style={{ background: 'var(--fam-card, #1A1C1F)', border: '1px solid var(--fx-border, #2A2D31)', borderRadius: 18, padding: 26 }}>
          <Charts month={month} chart={chart} summary={viewSummary} onChart={setChart} onPickMonth={pickMonth} onPickCat={pickCat} />
        </div>
        )}

        <div id="s-gastos" data-screen-label="Gastos" style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--fx-text-strong, #F2F3F4)', margin: 0 }}>{filters.mode === 'custom' ? 'Gastos do período' : 'Gastos de ' + mName}</h2>
              {summaryState === 'ready' && (
                <p style={{ fontSize: 14.5, color: 'var(--fx-text-2, #9A9DA1)', margin: '7px 0 0' }}>
                  {list.length + (list.length === 1 ? ' gasto' : ' gastos') + ' · ' + brl(reais(listCents))}
                </p>
              )}
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
          <div className="y2p-list" style={{ marginTop: 20, background: 'var(--fam-card, #1A1C1F)', border: '1px solid var(--fx-border, #2A2D31)', borderRadius: 18 }}>
            {rows.map((row) => (
              <div key={row.id} className="y2p-tx">
                <span className="y2p-mono" style={{ fontSize: 13, color: 'var(--fx-text-2, #9A9DA1)' }}>
                  {row.date.slice(8, 10) + '/' + row.date.slice(5, 7)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="y2p-ellipsis">{row.merchant}</span>
                    {row.fixed && <span className="y2p-mono y2p-fixo">fixo</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--fx-text-2, #9A9DA1)', marginTop: 2 }}>{row.addedBy.displayName}</span>
                </span>
                <select
                  aria-label={'Categoria de ' + row.merchant}
                  value={row.category}
                  onChange={(event) => void changeCategory(row.id, event.target.value as ExpenseCategory)}
                  style={{ background: 'transparent', color: 'var(--fx-silver, #C0C2C5)', border: '1px solid var(--fx-border, #2A2D31)', borderRadius: 8, padding: '4px 6px', fontFamily: "'Geist Mono', monospace", fontSize: 12 }}
                >
                  {(Object.entries(CATEGORY_LABEL) as [ExpenseCategory, string][]).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
                <span className="y2p-mono" style={{ color: 'var(--fx-text-strong, #F2F3F4)', textAlign: 'right', minWidth: 92 }}>
                  {brl(reais(row.amountCents))}
                </span>
                <button
                  type="button"
                  className={'y2p-tx-delete' + (confirmId === row.id ? ' is-confirm' : '')}
                  aria-label={(confirmId === row.id ? 'Confirmar apagar ' : 'Apagar ') + row.merchant}
                  title={confirmId === row.id ? 'Confirmar' : 'Apagar'}
                  onClick={() => void removeExpense(row.id)}
                >
                  {confirmId === row.id ? 'Confirmar' : <IconTrash />}
                </button>
              </div>
            ))}
            {futureHidden > 0 && (
              <p style={{ margin: 0, padding: '12px 16px', fontSize: 13, color: 'var(--fx-text-2, #9A9DA1)' }}>
                {futureHidden === 1 ? '1 lançamento com data futura ficou de fora do total de hoje.' : futureHidden + ' lançamentos com data futura ficaram de fora do total de hoje.'}
              </p>
            )}
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
          style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', background: 'var(--fam-card, #1A1C1F)', border: '1px solid var(--fx-border, #2A2D31)', borderRadius: 20, padding: 26, marginTop: 6 }}
        >
          <div style={{ flex: '1 1 280px', minWidth: 240 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fx-text-strong, #F2F3F4)', margin: 0 }}>
              {criptoOn ? (profile?.cryptoExperience === 'fund' ? 'Cripto, um passo além' : 'Cripto do zero') : 'Quando fizer sentido'}
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--fx-text-body, #C8CACD)', margin: '12px 0 0' }}>
              {criptoOn
                ? 'Aulas curtas para entender como cripto pode, ou não, entrar no plano de liberdade da família.'
                : 'Preparamos uma trilha curta e sem jargão sobre cripto e liberdade financeira. Fica aqui para quando você quiser.'}
            </p>
            {criptoOn ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--fx-text-2, #9A9DA1)' }}>
                  <span>{doneN} de {lessons.length} aulas</span>
                  <span>{lessons.length ? Math.round((doneN / lessons.length) * 100) : 0}%</span>
                </div>
                <div className="y2p-track" style={{ marginTop: 8 }}>
                  <span style={{ width: (lessons.length ? (doneN / lessons.length) * 100 : 0) + '%' }} />
                </div>
                {lessons.length > 0 && (
                  <button type="button" onClick={() => (doneN === lessons.length ? void restartLessons() : openLesson(doneN === 0 ? 1 : nextLesson + 1))} style={{ marginTop: 18, fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: 'var(--fx-text-strong, #F2F3F4)', background: 'rgba(255,255,255,.03)', border: '1px solid var(--fx-border-strong, #3A3D41)', borderRadius: 10, padding: '11px 20px', cursor: 'pointer' }}>
                    {doneN === lessons.length ? 'Trilha concluída · recomeçar' : doneN === 0 ? 'Começar aula 1' : 'Continuar · aula ' + (nextLesson + 1)}
                  </button>
                )}
              </>
            ) : (
              <button type="button" onClick={() => void showInterest()} style={{ marginTop: 18, fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: 'var(--fx-text-strong, #F2F3F4)', background: 'rgba(255,255,255,.03)', border: '1px solid var(--fx-border-strong, #3A3D41)', borderRadius: 10, padding: '11px 20px', cursor: 'pointer' }}>
                Tenho interesse
              </button>
            )}
          </div>
          {criptoOn && (
            <div style={{ flex: '1 1 280px', minWidth: 240 }}>
              {lessons.map((lesson, index) => (
                <button key={lesson.id} type="button" onClick={() => openLesson(index + 1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12, padding: '9px 0', border: 'none', borderBottom: '1px solid var(--fx-border, #2A2D31)', background: 'none', textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {lessonDone(lesson.id) ? <span className="y2p-check is-done">✓</span> : <span className="y2p-check y2p-mono">{index + 1}</span>}
                    <span style={{ fontSize: 14, color: 'var(--fx-text-strong, #F2F3F4)' }}>{presented[index]?.title ?? lesson.title}</span>
                  </span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: 'var(--fx-text-2, #9A9DA1)' }}>{lesson.durationMinutes} min</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {isOwner && profile?.showFamily !== false && (
          <form id="s-convidar" onSubmit={(event) => void onInvite(event)} style={{ background: 'var(--fam-card, #1A1C1F)', border: '1px solid var(--fx-border, #2A2D31)', borderRadius: 18, padding: 26, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <label htmlFor="y2p-invite" style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fx-text-2, #9A9DA1)' }}>Convidar</span>
              <input id="y2p-invite" type="email" value={inviteEmail} placeholder="email@familia.com" onChange={(event) => { setInviteEmail(event.target.value); setInviteError(''); setInviteOk(''); }} style={fieldStyle} />
            </label>
            <Button variant="secondary" size="sm" type="submit">Enviar convite</Button>
            {inviteError && <span style={{ flexBasis: '100%', fontSize: 14, color: '#E6E8EA' }}>{inviteError}</span>}
            {inviteOk && <span style={{ flexBasis: '100%', fontSize: 14, color: 'var(--fx-silver, #C0C2C5)' }}>{inviteOk}</span>}
          </form>
        )}
        </div>
      </main>

      {importOpen && (
        <ImportModal
          initialMode={importManual ? 'manual' : (profile?.importMode ?? 'ofx')}
          onClose={() => setImportOpen(false)}
          onImportFile={importFile}
          onUndoImport={undoImport}
          onListStatements={() => api().listStatements()}
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
          initial={profile?.onboardingCompleted ? {
            draft: draftFromSaved({
              fullName: account?.fullName ?? null,
              displayName: account?.displayName ?? null,
              goals: profile.goals,
              importMode: profile.importMode,
              familiarity: profile.cryptoFamiliarity,
              actions: profile.cryptoActions,
            }),
            switches: {
              showFreedom: profile.showFreedom !== false,
              showFamily: profile.showFamily !== false,
              learnCrypto: profile.cryptoExperience !== 'declined',
            },
          } : undefined}
          onSave={saveOnboarding}
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
  border: '1px solid var(--fx-border, #2A2D31)',
  borderRadius: 12,
  padding: '12px 14px',
  color: 'var(--fx-text-strong, #F2F3F4)',
  fontFamily: 'inherit',
  fontSize: 14,
  outline: 'none',
};
