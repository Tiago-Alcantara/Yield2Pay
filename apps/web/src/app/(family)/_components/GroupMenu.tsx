'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFamily } from '../_lib/FamilyProvider';
import { DockIcon } from './dockIcons';

/**
 * Botão de conta da doca. Mostra só o grupo real da conta, sem saldo,
 * sem meta e sem aviso de filtro. Fecha fora, com Esc, com Tab ou ao escolher.
 */
function groupInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function GroupMenu({
  name,
  initial,
  householdName,
}: {
  name: string;
  initial: string;
  /** Nome da casa vindo de /account. */
  householdName?: string;
}) {
  const router = useRouter();
  const { t } = useFamily();
  const d = t.dock;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = householdName?.trim() || d.account;

  function close(focusTrigger: boolean) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    items?.[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function onMenuKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next = current < 0 ? 0 : (current + step + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div ref={wrap} style={{ position: 'relative', display: 'flex' }}>
      {open && (
        <div
          ref={menuRef}
          id="y2p-grupos"
          className="dk-grp"
          role="menu"
          aria-label={d.groupsTitle}
          onKeyDown={onMenuKey}
        >
          <div className="dk-gh">
            <b>{d.groupsTitle}</b>
          </div>
          <div className="dk-g" role="presentation">
            <span className="dk-gi">{groupInitials(label)}</span>
            <span className="dk-gt">
              <b>{label}</b>
            </span>
          </div>
          <div className="dk-gs" />
          <button
            type="button"
            className="dk-ga"
            role="menuitem"
            onClick={() => {
              close(false);
              router.push('/dashboard?conta=1');
            }}
          >
            <DockIcon name="plus" size={16} />
            {d.newGroup}
          </button>
          <button
            type="button"
            className="dk-ga"
            role="menuitem"
            onClick={() => {
              close(false);
              router.push('/conta');
            }}
          >
            <DockIcon name="cog" size={16} />
            {d.myAccount}
          </button>
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        className="dk-acct"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="y2p-grupos"
        aria-label={d.switchGroup}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dk-av">{initial}</span>
        <span className="dk-us">
          <b>{name}</b>
          <em>{label}</em>
        </span>
        <DockIcon name="down" size={14} />
      </button>
    </div>
  );
}
