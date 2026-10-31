'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';
import { useFamily } from '../_lib/FamilyProvider';
import { getAccountView, setAccountView, useAccountView } from '../_lib/accountStore';
import { createHouseholdApi } from '../_lib/householdApi';
import { LOCAL_DEV_TOKEN } from '../_lib/localSession';
import { onLiberdadeChange, readLiberdade } from '../_lib/liberdadePref';
import { DockIcon, type DockIconName } from './dockIcons';
import { GroupMenu } from './GroupMenu';

/** Telas logadas da família que mostram a doca. */
const DOCK_PREFIXES = ['/dashboard', '/aprender', '/conceitos', '/configuracoes', '/conta'];

export function showsDock(pathname: string | null): boolean {
  if (!pathname) return false;
  return DOCK_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Item ativo: /aprender e /conceitos → Aprender; /configuracoes → nenhum; demais → Painel. */
export function activeDockItem(pathname: string): 'painel' | 'aprender' | null {
  if (pathname.startsWith('/aprender') || pathname.startsWith('/conceitos')) return 'aprender';
  if (pathname.startsWith('/configuracoes')) return null;
  return 'painel';
}

const NAV: Array<{ id: string; icon: DockIconName; href: string }> = [
  { id: 'painel', icon: 'grid', href: '/dashboard' },
  { id: 'gastos', icon: 'lines', href: '/dashboard#s-gastos' },
  // Sem rota própria ainda: leva à seção "Liberdade" do painel.
  { id: 'liberdade', icon: 'shield', href: '/dashboard#s-liberdade' },
  { id: 'aprender', icon: 'book', href: '/aprender' },
];

type GetToken = () => Promise<string | null>;

/** Busca a conta uma vez quando a doca abre fora do painel. */
function useLoadAccount(getToken: GetToken, enabled: boolean) {
  const tokenRef = React.useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  });
  useEffect(() => {
    if (!enabled || getAccountView()) return;
    let cancelled = false;
    createHouseholdApi(() => tokenRef.current())
      .getAccount()
      .then((view) => {
        if (!cancelled && !getAccountView()) setAccountView(view);
      })
      .catch(() => {
        /* sem conta: a doca usa o nome do perfil local */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
}

function PrivyAccountLoader({ enabled }: { enabled: boolean }) {
  const { getAccessToken, authenticated, ready } = usePrivy();
  useLoadAccount(getAccessToken, enabled && authenticated);
  React.useEffect(() => {
    if (ready && !authenticated) setAccountView(null);
  }, [ready, authenticated]);
  return null;
}

function LocalAccountLoader({ enabled }: { enabled: boolean }) {
  useLoadAccount(async () => LOCAL_DEV_TOKEN, enabled);
  return null;
}

/**
 * Doca flutuante — substitui a barra lateral do painel em todas as telas
 * logadas da família.
 */
export function Dock() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, t } = useFamily();
  const visible = showsDock(pathname);
  const d = t.dock;

  const liberdadeOn = useSyncExternalStore(onLiberdadeChange, readLiberdade, () => true);
  const account = useAccountView();

  // Reserva espaço para a doca no rodapé (ver family.css).
  useEffect(() => {
    if (!visible) return;
    document.body.classList.add('fam-has-dock');
    return () => document.body.classList.remove('fam-has-dock');
  }, [visible]);

  const loader = isPrivyConfigured ? <PrivyAccountLoader enabled={visible} /> : <LocalAccountLoader enabled={visible} />;

  if (!visible || !pathname) return loader;

  const active = activeDockItem(pathname);
  const canInvite = account?.household?.role === 'owner';
  const fromApi = account?.displayName?.trim() || account?.fullName?.trim().split(/\s+/)[0];
  const firstName = fromApi || state.profile.name.trim().split(/\s+/)[0] || d.account;
  const initial = (account?.initials && account.initials !== '?' ? account.initials : firstName).charAt(0).toUpperCase();

  /** Ação do painel (?acao=…): navega e o painel abre o modal/seção. */
  const quick = (acao: 'importar' | 'novo' | 'convidar') => () =>
    router.push(`/dashboard?acao=${acao}`);

  return (
    <nav id="y2p-dock" aria-label={d.aria}>
      {loader}
      <GroupMenu name={firstName} initial={initial} householdName={account?.household?.name} />
      <span className="dk-sep" />
      {NAV.filter((i) => i.id !== 'liberdade' || liberdadeOn).map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="dk-it"
          aria-current={active === item.id ? 'page' : undefined}
        >
          <DockIcon name={item.icon} />
          <span>{d.nav[item.id as keyof typeof d.nav]}</span>
        </Link>
      ))}
      <span className="dk-sep dk-sep-q" />
      <button type="button" className="dk-qb" title={d.import} aria-label={d.import} onClick={quick('importar')}>
        <DockIcon name="upload" size={18} />
      </button>
      {liberdadeOn && (
        <Link className="dk-qb" title={d.goal} aria-label={d.goal} href="/dashboard#s-liberdade">
          <DockIcon name="target" size={18} />
        </Link>
      )}
      {canInvite && (
        <button type="button" className="dk-qb" title={d.invite} aria-label={d.invite} onClick={quick('convidar')}>
          <DockIcon name="users" size={18} />
        </button>
      )}
      <button type="button" className="dk-cta" aria-label={d.newExpense} onClick={quick('novo')}>
        <DockIcon name="plus" size={16} />
        {d.newExpense}
      </button>
    </nav>
  );
}
