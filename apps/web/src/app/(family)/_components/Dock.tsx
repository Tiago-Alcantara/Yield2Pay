'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useFamily } from '../_lib/FamilyProvider';
import { onLiberdadeChange, readLiberdade } from '../_lib/liberdadePref';
import { DockIcon, type DockIconName } from './dockIcons';

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

  // Reserva espaço para a doca no rodapé (ver family.css).
  useEffect(() => {
    if (!visible) return;
    document.body.classList.add('fam-has-dock');
    return () => document.body.classList.remove('fam-has-dock');
  }, [visible]);

  if (!visible || !pathname) return null;

  const active = activeDockItem(pathname);
  const firstName = state.profile.name.trim().split(/\s+/)[0] || d.account;
  const initial = firstName.charAt(0).toUpperCase();

  /** Ação do painel (?acao=…): navega e o painel abre o modal/seção. */
  const quick = (acao: 'importar' | 'novo' | 'convidar') => () =>
    router.push(`/dashboard?acao=${acao}`);

  return (
    <nav id="y2p-dock" aria-label={d.aria}>
      <Link href="/conta" className="dk-acct" aria-label={d.account}>
        <span className="dk-av">{initial}</span>
        <span className="dk-us">
          <b>{firstName}</b>
        </span>
      </Link>
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
      <Link className="dk-qb" title={d.goal} aria-label={d.goal} href="/dashboard#s-liberdade">
        <DockIcon name="target" size={18} />
      </Link>
      <button type="button" className="dk-qb" title={d.invite} aria-label={d.invite} onClick={quick('convidar')}>
        <DockIcon name="users" size={18} />
      </button>
      <button type="button" className="dk-cta" aria-label={d.newExpense} onClick={quick('novo')}>
        <DockIcon name="plus" size={16} />
        {d.newExpense}
      </button>
    </nav>
  );
}
