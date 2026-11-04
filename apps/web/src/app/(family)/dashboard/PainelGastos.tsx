'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useIdentityToken, usePrivy } from '@privy-io/react-auth';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { AccountView, CompleteOnboarding, ExpenseCategory, ExpenseView, HouseholdProfile, HouseholdSummary, LessonProgressView, LessonView, MonthTotal } from '@yield2pay/shared';
import { LOCAL_DEV_TOKEN } from '../_lib/localSession';
import { Button } from '@/components/Button';
import { MetalCard } from '@/components/MetalCard';
import { useIsMobile } from '@/lib/useIsMobile';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';
import { createHouseholdApi, DASHBOARD_LOAD_TIMEOUT_MS, EXPENSE_PAGE_CAP_NOTE, type ExpenseRows } from '../_lib/householdApi';
import { setAccountView } from '../_lib/accountStore';
import { AppSplash } from '../_components/loading/AppSplash';
import { PainelSkeleton } from '../_components/loading/PainelSkeleton';
import { useTopProgress } from '../_components/loading/TopProgress';
import { WaveReveal } from '../_components/loading/WaveReveal';
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
  mesNome,
  metaLabel,
  MONTH_RANGE_CAP_NOTE,
  isValidMonth,
  monthArrowSteps,
  monthsCovering,
  nf,
  shiftMonth,
  openingMonth,
  reais,
  saoPauloDay,
  saoPauloMonth,
  saoPauloToday,
  sortMonths,
  type ChartId,
} from './painel-format';

function categoriesOf(rows: ExpenseView[]) {
  const totals = new Map<ExpenseCategory, number>();
  for (const row of rows) {
    if (row.category != null) totals.set(row.category, (totals.get(row.category) ?? 0) + row.amountCents);
  }
  return [...totals.entries()]
    .filter(([, amountCents]) => amountCents > 0)
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((left, right) => right.amountCents - left.amountCents);
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

/** Indicador do painel: rótulo, número e com o que ele se compara. */
function StatCard({
  title,
  value,
  label,
  sub,
  className,
}: {
  title: string;
  value: string;
  label: string;
  sub: string;
  className?: string;
}) {
  return (
    <div className={'y2p-stat' + (className ? ' ' + className : '')}>
      <div className="y2p-stat-t">{title}</div>
      <div className="y2p-stat-v">{value}</div>
      <div className="y2p-stat-l">{label}</div>
      <div className="y2p-stat-s">{sub}</div>
    </div>
  );
}

/**
 * Régua de meses: a barra da liberdade dividida nos meses da meta.
 * Metas longas viram 12 marcas, cada uma valendo mais de um mês.
 */
function MonthRuler({ months, goal }: { months: number; goal: number | null | undefined }) {
  const segments = goal ? Math.min(goal, 12) : 12;
  const perSegment = goal ? goal / segments : 1;
  const filled = goal ? months / perSegment : 0;
  return (
    <div className="y2p-ruler" aria-hidden="true">
      {Array.from({ length: segments }, (_, index) => (
        <span key={index}>
          <i style={{ width: Math.max(0, Math.min(1, filled - index)) * 100 + '%' }} />
        </span>
      ))}
    </div>
  );
}

type GetToken = () => Promise<string | null>;

function emptyExpenseRows(): ExpenseRows {
  return Object.assign([] as ExpenseView[], { truncated: false });
}

export default function PainelGastos() {
  if (!isPrivyConfigured) {
    return <PainelScreen getToken={async () => LOCAL_DEV_TOKEN} />;
  }
  return <PrivyPainel />;
}

function PrivyPainel() {
  const { getAccessToken, logout } = usePrivy();
  const { identityToken } = useIdentityToken();
  return (
    <PainelScreen
      getToken={getAccessToken}
      getIdentityToken={async () => identityToken ?? null}
      onLogout={() => { setAccountView(null); void logout(); }}
    />
  );
}

function PainelScreen({
  getToken,
  getIdentityToken,
  onLogout,
}: {
  getToken: GetToken;
  getIdentityToken?: () => Promise<string | null>;
  onLogout?: () => void;
}) {
  const getTokenRef = useRef(getToken);
  const getIdentityRef = useRef(getIdentityToken);
  useEffect(() => {
    getTokenRef.current = getToken;
    getIdentityRef.current = getIdentityToken;
  });
  const monthRequest = useRef(0);
  const expenseCache = useRef<Record<string, ExpenseRows>>({});
  const summaryCache = useRef<Record<string, HouseholdSummary>>({});

  const [phase, setPhase] = useState<'panel' | 'name' | 'onboarding'>('panel');
  const [account, setAccount] = useState<AccountView | null>(null);
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);
  const [summary, setSummary] = useState<HouseholdSummary>(EMPTY_SUMMARY);
  const [expenses, setExpenses] = useState<ExpenseView[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [monthTotals, setMonthTotals] = useState<MonthTotal[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => saoPauloMonth());
  // As setas saem dos meses com gasto e do mês atual, sem estado próprio.
  const arrowMonths = useMemo(
    () => monthArrowSteps(monthTotals.map((row) => row.month), currentMonth),
    [monthTotals, currentMonth],
  );
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
  const [inviteNotice, setInviteNotice] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importManual, setImportManual] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [liberdadeOn, setLiberdadeOn] = useState(true);
  const [summaryState, setSummaryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const pendingAcao = useRef<'importar' | 'novo' | 'convidar' | null>(null);
  const pendingConta = useRef(false);
  const settledHash = useRef<string | null>(null);
  const [rangeNote, setRangeNote] = useState('');
  const [pageNote, setPageNote] = useState('');
  const isMobile = useIsMobile();
  const router = useRouter();
  const topProgress = useTopProgress();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();

  const api = () => createHouseholdApi(() => getTokenRef.current(), {
    getIdentityToken: getIdentityRef.current,
  });

  // A doca mostra o nome e a família da conta carregada aqui.
  useEffect(() => {
    if (account) setAccountView(account);
  }, [account]);

  // A doca chega com ?acao= ou ?conta=1. useSearchParams reage com o painel
  // já montado. A query sai depois; ação desconhecida não abre nada.
  useEffect(() => {
    const params = new URLSearchParams(queryKey);
    const acao = params.get('acao');
    const conta = params.get('conta');
    if (acao === 'importar' || acao === 'novo' || acao === 'convidar') pendingAcao.current = acao;
    if (conta === '1') pendingConta.current = true;
    if (!acao && conta !== '1') return;
    if (acao) params.delete('acao');
    if (conta === '1') params.delete('conta');
    const query = params.toString();
    const next = `${pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    // router.replace devolve a query: o HistoryUpdater do Next grava ?acao e ?conta de novo.
    // replaceState(null) é o caminho documentado pelo Next para mudar a URL por fora:
    // o patch dele copia o state interno e avisa o router, então a URL canônica fica
    // limpa e o próximo clique da doca no mesmo endereço volta a disparar estes
    // efeitos. É replace, não push: o reload não empilha histórico nem reabre o diálogo.
    window.history.replaceState(null, '', next);
  }, [queryKey, pathname]);

  useEffect(() => {
    const acao = pendingAcao.current;
    const openConta = pendingConta.current;
    if (!acao && !openConta) return;
    const frame = requestAnimationFrame(() => {
      if (pendingConta.current) {
        pendingConta.current = false;
        setSettingsOpen(true);
      }
      if (!acao || pendingAcao.current !== acao) return;
      if (acao === 'importar' || acao === 'novo') {
        pendingAcao.current = null;
        setImportManual(acao === 'novo');
        setImportOpen(true);
        return;
      }
      if (!account || !profile) return;
      if (account.activeHousehold?.role !== 'owner') {
        pendingAcao.current = null;
        setInviteNotice('Só quem administra a casa pode convidar.');
        return;
      }
      if (profile.showFamily === false) {
        pendingAcao.current = null;
        setInviteNotice('A família está oculta nas configurações. Ative para convidar.');
        return;
      }
      const field = document.getElementById('y2p-invite');
      if (!(field instanceof HTMLElement)) return;
      pendingAcao.current = null;
      setInviteNotice('');
      scrollToId('s-convidar');
      field.focus();
    });
    return () => cancelAnimationFrame(frame);
    // summaryState: com o skeleton na tela, #y2p-invite só volta a existir no fim da carga.
  }, [account, profile, queryKey, summaryState]);

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

  // O mês pode virar com a página aberta: a seta "próximo" acompanha o mês atual + 1.
  useEffect(() => {
    const timer = setInterval(() => setCurrentMonth(saoPauloMonth()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // No acesso direto a /dashboard#s-..., a seção só existe depois da carga.
  // Com o painel montado, o Link da doca faz pushState (sem hashchange) e o
  // Next rola com scrollIntoView, que usa o scroll-margin-top da seção.
  // Com o skeleton, a seção some durante a carga de outro mês. No fim dessa carga
  // só rola se o hash mudou nesse meio-tempo (clique na doca que o Next não
  // conseguiu rolar): trocar de mês com #s-gastos na URL não move a página.
  useEffect(() => {
    if (phase !== 'panel') {
      settledHash.current = null;
      return;
    }
    const hash = window.location.hash;
    if (summaryState === 'loading') {
      if (settledHash.current !== null) settledHash.current = hash;
      return;
    }
    if (summaryState !== 'ready' || hash === settledHash.current) return;
    settledHash.current = hash;
    const id = hash.replace('#', '');
    if (id.startsWith('s-')) requestAnimationFrame(() => scrollToId(id));
  }, [phase, summaryState]);

  // A altura do cabeçalho fixo muda com a largura e com os filtros ativos.
  // O valor medido vira --y2p-header-height, a folga das seções em painel.css.
  useEffect(() => {
    if (phase !== 'panel') return;
    const header = document.getElementById('painel-header');
    const root = header?.closest('.y2p');
    if (!header || !(root instanceof HTMLElement)) return;
    const writeHeaderHeight = () => {
      root.style.setProperty('--y2p-header-height', `${Math.round(header.getBoundingClientRect().height)}px`);
    };
    writeHeaderHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(writeHeaderHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, [phase]);

  useEffect(() => {
    document.body.style.overflow = onbOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [onbOpen]);

  useEffect(() => {
    const cancel = new AbortController();
    const deadline = new AbortController();
    const timer = setTimeout(() => {
      deadline.abort(new DOMException('The operation timed out', 'TimeoutError'));
    }, DASHBOARD_LOAD_TIMEOUT_MS);
    const client = createHouseholdApi(() => getTokenRef.current(), {
      timeoutMs: 0,
      signal: AbortSignal.any([deadline.signal, cancel.signal]),
      getIdentityToken: getIdentityRef.current,
    });
    let cancelled = false;
    let finished = false;
    const finishProgress = () => {
      if (finished) return;
      finished = true;
      topProgress.done();
    };
    topProgress.start();
    (async () => {
      try {
        const accountView = await client.getAccount();
        if (cancelled) return;
        if (!accountView.activeHousehold) {
          setAccount(accountView);
          setPhase('onboarding');
          return;
        }
        const selected = openingMonth([]);
        const [profileView, current, monthList, expenseRows, summaryView, progressRows, beginnerLessons, fundLessons] = await Promise.all([
          client.getProfile(),
          client.getCurrentHousehold(),
          client.getExpenseMonths(),
          client.getExpenses({ month: selected }),
          client.getHouseholdSummary({ month: selected }),
          client.getLessonProgress().catch(() => [] as LessonProgressView[]),
          client.getLessons('beginner').catch(() => [] as LessonView[]),
          client.getLessons('fund').catch(() => [] as LessonView[]),
        ]);
        if (cancelled) return;
        const sorted = sortMonths(monthList.map((row) => row.month).filter(isValidMonth));
        const track = lessonTrack(profileView.cryptoExperience);
        expenseCache.current[selected] = expenseRows;
        summaryCache.current[selected] = summaryView;
        setPageNote(expenseRows.truncated ? EXPENSE_PAGE_CAP_NOTE : '');
        setAccount({
          ...accountView,
          activeHousehold: {
            ...accountView.activeHousehold,
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
        setLessons(track === 'fund' ? fundLessons : track ? beginnerLessons : []);
        setSummaryState('ready');
        setPhase('panel');
        if (!current.onboardingCompleted) setOnbOpen(true);
      } catch {
        if (!cancelled) {
          setSummaryState('error');
          setPhase('panel');
        }
      } finally {
        finishProgress();
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancel.abort();
      finishProgress();
    };
  }, [loadAttempt, topProgress]);

  function forgetCachedMonths() {
    expenseCache.current = {};
    summaryCache.current = {};
  }

  function rememberMonth(next: string, expenseRows: ExpenseRows, summaryView: HouseholdSummary) {
    expenseCache.current[next] = expenseRows;
    summaryCache.current[next] = summaryView;
  }

  function pickMonth(next: string) {
    setRangeNote('');
    setFilters((current) => (current.mode === 'mes' ? current : { ...current, mode: 'mes' }));
    setShowAll(false);
    const cachedExpenses = expenseCache.current[next];
    const cachedSummary = summaryCache.current[next];
    if (next === month && filters.mode === 'mes' && cachedExpenses && cachedSummary) return;
    monthRequest.current += 1;
    const request = monthRequest.current;
    setMonth(next);
    setConfirmId(null);
    if (cachedExpenses && cachedSummary) {
      setExpenses(cachedExpenses);
      setSummary(cachedSummary);
      setSummaryState('ready');
      setPageNote(cachedExpenses.truncated ? EXPENSE_PAGE_CAP_NOTE : '');
      return;
    }
    setSummaryState('loading');
    const client = api();
    Promise.all([
      cachedExpenses ? Promise.resolve(cachedExpenses) : client.getExpenses({ month: next }),
      cachedSummary ? Promise.resolve(cachedSummary) : client.getHouseholdSummary({ month: next }),
    ])
      .then(([expenseRows, summaryView]) => {
        if (monthRequest.current !== request) return;
        rememberMonth(next, expenseRows, summaryView);
        setPageNote(expenseRows.truncated ? EXPENSE_PAGE_CAP_NOTE : '');
        setExpenses(expenseRows);
        setSummary(summaryView);
        setSummaryState('ready');
      })
      .catch(() => {
        if (monthRequest.current !== request) return;
        setSummaryState('error');
      });
  }

  function pickCat(label: string) {
    const id = categoryId(label);
    setFilters((current) => ({ ...current, cats: id ? [id] : [] }));
    setShowAll(false);
    scrollToId('s-gastos');
  }

  async function loadMonths(targets: string[]) {
    const client = api();
    const missing = targets.filter((item) => !expenseCache.current[item]);
    if (missing.length > 0) {
      const pages = await Promise.all(missing.map((item) => client.getExpenses({ month: item })));
      missing.forEach((item, index) => {
        expenseCache.current[item] = pages[index] ?? emptyExpenseRows();
      });
      if (pages.some((page) => page.truncated)) setPageNote(EXPENSE_PAGE_CAP_NOTE);
    }
    return targets.flatMap((item) => expenseCache.current[item] ?? []);
  }

  function applyFilters(next: ExpenseFilters, nextMonth: string) {
    setFilters(next);
    setShowAll(false);
    if (next.mode === 'custom') {
      const covered = monthsCovering(next.from, next.to);
      setRangeNote(covered.truncated ? MONTH_RANGE_CAP_NOTE : '');
      const request = ++monthRequest.current;
      setSummaryState('loading');
      void loadMonths(covered.months)
        .then((rows) => {
          if (monthRequest.current !== request) return;
          setExpenses(rows);
          setSummaryState('ready');
        })
        .catch(() => {
          if (monthRequest.current !== request) return;
          setSummaryState('error');
        });
      return;
    }
    setRangeNote('');
    if (nextMonth !== month) pickMonth(nextMonth);
    else if (expenseCache.current[nextMonth]) setExpenses(expenseCache.current[nextMonth]);
  }

  async function refresh(selected: string) {
    const client = api();
    forgetCachedMonths();
    const covered = filters.mode === 'custom' ? monthsCovering(filters.from, filters.to) : { months: [selected], truncated: false };
    const targets = covered.months;
    setRangeNote(covered.truncated ? MONTH_RANGE_CAP_NOTE : '');
    const [monthList, pages, summaryView] = await Promise.all([
      client.getExpenseMonths(),
      Promise.all(targets.map((item) => client.getExpenses({ month: item }))),
      client.getHouseholdSummary({ month: selected }),
    ]);
    targets.forEach((item, index) => {
      expenseCache.current[item] = pages[index] ?? emptyExpenseRows();
    });
    setPageNote(pages.some((page) => page.truncated) ? EXPENSE_PAGE_CAP_NOTE : '');
    summaryCache.current[selected] = summaryView;
    const sorted = sortMonths(monthList.map((row) => row.month).filter(isValidMonth));
    setExpenses(filters.mode === 'custom' ? targets.flatMap((item) => expenseCache.current[item] ?? []) : expenseCache.current[selected] ?? []);
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
    await api().patchExpense(id, { category });
    await refresh(month);
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
      setMonthTotals([]);
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
    if (!account?.activeHousehold) {
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
    const href = aprenderPath(lessonNumber);
    topProgress.startNavigation(href);
    router.push(href);
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
  const statusLabel = pctReal == null ? 'Meta em aberto' : pctReal >= 100 ? 'Meta alcançada' : 'Em andamento';
  const sentence = libertySentence(freedom, reserveCents, goal);
  const houseName = account?.activeHousehold?.name?.trim() || 'Painel da família';
  const initials = account?.initials || '?';
  const isOwner = account?.activeHousehold?.role === 'owner';
  const pills = months.length ? months : [month];
  const totals: Record<string, number> = {};
  for (const row of monthTotals) totals[row.month] = row.amountCents;
  if (partial) totals[month] = summary.monthTotalCents;
  const present = new Set(expenses.flatMap((row) => (row.category != null ? [CATEGORY_LABEL[row.category]] : [])));
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
      <AppSplash loading={summaryState === 'loading'} />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', paddingBottom: 128 }}>
        <header
          id="painel-header"
          className="y2p-header"
          style={{
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            flexDirection: isMobile ? 'column' : 'row',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            gap: isMobile ? 12 : 16,
            padding: isMobile ? '12px 16px' : '16px var(--y2p-gutter)',
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
              <h1 className="y2p-title y2p-ellipsis">{houseName}</h1>
              <div className="y2p-title-sub">
                {upcoming ? cap(mName) + ' ainda não começou' : partial ? cap(mName) + ' até agora' : 'Como foi ' + mName}
              </div>
            </div>
            {isMobile && (
              <button type="button" aria-label="Configurações" onClick={() => setSettingsOpen(true)} style={{ flex: 'none', width: 36, height: 36, borderRadius: '50%', background: 'var(--fam-avatar, linear-gradient(160deg,#43464b,#1b1d21))', border: '1px solid var(--fx-border, #2A2D31)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--fam-on-avatar, #d4d6d9)', cursor: 'pointer', padding: 0 }}>
                {initials}
              </button>
            )}
          </div>
          <div className="y2p-header-actions" style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, width: isMobile ? '100%' : undefined, minWidth: 0 }}>
            <div style={{ flex: isMobile ? 1 : undefined, minWidth: 0, width: isMobile ? '100%' : undefined }}>
              <FilterBar
                month={month}
                months={pills}
                arrowMonths={arrowMonths}
                totals={totals}
                expenses={expenses}
                filters={filters}
                onFilters={setFilters}
                onMonth={pickMonth}
                onApply={applyFilters}
              />
            </div>
            {!isMobile && (
              <button type="button" aria-label="Configurações" onClick={() => setSettingsOpen(true)} style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: 'var(--fam-avatar, linear-gradient(160deg,#43464b,#1b1d21))', border: '1px solid var(--fx-border, #2A2D31)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--fam-on-avatar, #d4d6d9)', cursor: 'pointer', padding: 0 }}>
                {initials}
              </button>
            )}
          </div>
        </header>
        {inviteNotice && (
          <p role="status" style={{ margin: '16px 32px 0', fontSize: 14, color: 'var(--fx-text-strong, #F2F3F4)' }}>
            {inviteNotice}
          </p>
        )}

        <div
          id="s-topo"
          className="y2p-dashboard__section y2p-page"
          aria-busy={summaryState === 'loading'}
          // Só no desktop. No celular, o padding e a largura seguem .y2p-page.
          style={isMobile ? undefined : { padding: '32px var(--y2p-gutter)', maxWidth: 'none' }}
        >
        {summaryState === 'loading' ? (
        <PainelSkeleton liberdadeOn={liberdadeOn} />
        ) : (
        <WaveReveal runKey={loadAttempt}>
        <div data-reveal className={'y2p-top' + (liberdadeOn ? '' : ' is-single')}>
          <div className="y2p-card-plain y2p-spend">
            <div className="y2p-stat-t">{kpis[0].label}</div>
            <div className="y2p-figure">{kpis[0].value}</div>
            <div role={summaryState === 'error' ? 'alert' : undefined} className="y2p-stat-l">{kpis[0].sub}</div>
            <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="primary" size="sm" onClick={() => { setImportManual(false); setImportOpen(true); }}>Importar extrato</Button>
              {summaryState === 'error' && (
                <Button variant="secondary" size="sm" onClick={() => { setSummaryState('loading'); setLoadAttempt((attempt) => attempt + 1); }}>Tentar de novo</Button>
              )}
            </div>
          </div>
          {liberdadeOn && (
            <MetalCard id="s-liberdade" className="y2p-dashboard__section" data-screen-label="Liberdade" padding={24} radius="16px" sweep="none" aria-label="Liberdade da família">
              <div className="y2p-lib-card">
                <div className="y2p-lib-row">
                  <span className="y2p-stat-t">Liberdade</span>
                  <span className="y2p-lib-badge">{statusLabel}</span>
                </div>
                <div className="y2p-lib-hero">
                  <b>{pctReal == null ? '—' : pctReal + '%'}</b>
                  <span>percentual de liberdade</span>
                  {freedom && <em>{nf(freedom.months, 1)}{goal ? ' de ' + goal : ''} meses</em>}
                </div>
                <p className="y2p-lib-sent">{sentence}</p>
                <div>
                  <MonthRuler months={freedom?.months ?? 0} goal={goal} />
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
        <div data-reveal className="y2p-stats">
          <StatCard title={kpis[1].label} value={kpis[1].value} label="Depois da renda da casa" sub={kpis[1].sub || 'Renda ainda não informada'} />
          <StatCard title="Gasto médio" value={brl0(reais(summary.averageCents))} label="Meses já fechados" sub={partial ? 'Projeção ' + brl0(reais(summary.projectedCents)) : 'Base da reserva'} />
          <StatCard className="y2p-stat--wide" title={kpis[3].label} value={kpis[3].value} label="Onde mais saiu neste mês" sub={kpis[3].sub || 'Sem gastos no mês'} />
        </div>
        )}

        {summaryState === 'ready' && (
        <div data-reveal className="y2p-card-plain">
          <Charts month={month} chart={chart} summary={viewSummary} onChart={setChart} onPickMonth={pickMonth} onPickCat={pickCat} />
        </div>
        )}

        <div id="s-gastos" data-reveal className="y2p-dashboard__section y2p-section" data-screen-label="Gastos">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 className="y2p-section-h">{filters.mode === 'custom' ? 'Gastos do período' : 'Gastos de ' + mName}</h2>
              {rangeNote ? <p role="status" className="y2p-note">{rangeNote}</p> : null}
              {pageNote ? <p role="status" className="y2p-note">{pageNote}</p> : null}
              {summaryState === 'ready' && (
                <p className="y2p-section-sub">
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
          <div className="y2p-list y2p-card-plain">
            {rows.map((row) => (
              <div key={row.id} className="y2p-tx">
                <span className="y2p-mono" style={{ fontSize: 12, color: 'var(--fx-text-3, #8a8d91)' }}>
                  {row.date.slice(8, 10) + '/' + row.date.slice(5, 7)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="y2p-ellipsis">{row.merchant}</span>
                    {row.fixed && <span className="y2p-fixo">fixo</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--fx-text-3, #8a8d91)', marginTop: 2 }}>{row.addedBy.displayName}</span>
                </span>
                <select
                  aria-label={'Categoria de ' + row.merchant}
                  value={row.category ?? undefined}
                  onChange={(event) => void changeCategory(row.id, event.target.value as ExpenseCategory)}
                  className="y2p-tx-cat"
                >
                  {(Object.entries(CATEGORY_LABEL) as [ExpenseCategory, string][]).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
                <span className="y2p-num" style={{ color: 'var(--fx-text-strong, #F2F3F4)', textAlign: 'right', minWidth: 96 }}>
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
              <p style={{ margin: 0, padding: '12px 24px', fontSize: 13, color: 'var(--fx-text-2, #9A9DA1)', borderTop: '1px solid var(--fx-border, #2A2D31)' }}>
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
          data-reveal
          className="y2p-dashboard__section y2p-card-plain y2p-learn"
          data-screen-label="Aprender"
        >
          <div style={{ flex: '1 1 280px', minWidth: 240 }}>
            <h2 className="y2p-card-h">
              {criptoOn ? (profile?.cryptoExperience === 'fund' ? 'Cripto, um passo além' : 'Cripto do zero') : 'Quando fizer sentido'}
            </h2>
            <p className="y2p-card-p">
              {criptoOn
                ? 'Aulas curtas para entender como cripto pode, ou não, entrar no plano de liberdade da família.'
                : 'Preparamos uma trilha curta e sem jargão sobre cripto e liberdade financeira. Fica aqui para quando você quiser.'}
            </p>
            {criptoOn ? (
              <>
                <div className="y2p-num" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, fontSize: 13, color: 'var(--fx-text-2, #9A9DA1)' }}>
                  <span>{doneN} de {lessons.length} aulas</span>
                  <span>{lessons.length ? Math.round((doneN / lessons.length) * 100) : 0}%</span>
                </div>
                <div className="y2p-track" style={{ marginTop: 8 }}>
                  <span style={{ width: (lessons.length ? (doneN / lessons.length) * 100 : 0) + '%' }} />
                </div>
                {lessons.length > 0 && (
                  <button type="button" className="y2p-btn-quiet" onClick={() => (doneN === lessons.length ? void restartLessons() : openLesson(doneN === 0 ? 1 : nextLesson + 1))}>
                    {doneN === lessons.length ? 'Trilha concluída · recomeçar' : doneN === 0 ? 'Começar aula 1' : 'Continuar · aula ' + (nextLesson + 1)}
                  </button>
                )}
              </>
            ) : (
              <button type="button" className="y2p-btn-quiet" onClick={() => void showInterest()}>
                Tenho interesse
              </button>
            )}
          </div>
          {criptoOn && (
            <div style={{ flex: '1 1 280px', minWidth: 240 }}>
              {lessons.map((lesson, index) => (
                <button key={lesson.id} type="button" className="y2p-lesson-row" onClick={() => openLesson(index + 1)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    {lessonDone(lesson.id) ? <span className="y2p-check is-done">✓</span> : <span className="y2p-check y2p-mono">{index + 1}</span>}
                    <span className="y2p-ellipsis" style={{ fontSize: 14, color: 'var(--fx-text-strong, #F2F3F4)' }}>{presented[index]?.title ?? lesson.title}</span>
                  </span>
                  <span className="y2p-mono" style={{ flex: 'none', fontSize: 12, color: 'var(--fx-text-3, #8a8d91)' }}>{lesson.durationMinutes} min</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {isOwner && profile?.showFamily !== false && (
          <form id="s-convidar" data-reveal className="y2p-dashboard__section y2p-card-plain y2p-invite-form" onSubmit={(event) => void onInvite(event)}>
            <label htmlFor="y2p-invite" style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="y2p-stat-t">Convidar</span>
              <input id="y2p-invite" type="email" value={inviteEmail} placeholder="email@familia.com" onChange={(event) => { setInviteEmail(event.target.value); setInviteError(''); setInviteOk(''); }} style={fieldStyle} />
            </label>
            <Button variant="secondary" size="sm" type="submit">Enviar convite</Button>
            {inviteError && <span style={{ flexBasis: '100%', fontSize: 14, color: 'var(--fx-text-strong, #F2F3F4)' }}>{inviteError}</span>}
            {inviteOk && <span style={{ flexBasis: '100%', fontSize: 14, color: 'var(--fx-text-2, #9A9DA1)' }}>{inviteOk}</span>}
          </form>
        )}
        </WaveReveal>
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
        getIdentityToken={getIdentityToken}
        onLogout={onLogout}
        onAccount={(next) => setAccount((prev) => (
          prev?.activeHousehold && next.activeHousehold
            ? { ...next, activeHousehold: { ...next.activeHousehold, role: prev.activeHousehold.role, onboardingCompleted: prev.activeHousehold.onboardingCompleted } }
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
          setAccount((prev) => (prev ? { ...prev, activeHousehold: null } : prev));
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
  background: 'var(--fx-surface-1, #131417)',
  border: '1px solid var(--fx-border, #2A2D31)',
  borderRadius: 10,
  height: 40,
  padding: '0 12px',
  color: 'var(--fx-text-strong, #F2F3F4)',
  fontFamily: 'inherit',
  fontSize: 14,
};
