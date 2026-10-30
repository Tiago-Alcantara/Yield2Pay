'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useFamily } from '../_lib/FamilyProvider';
import { GROUPS, onGroupChange, readGroup, readGroupServer, writeGroup, type GroupId } from '../_lib/groupStore';
import { DockIcon } from './dockIcons';

/**
 * Botão de conta da doca + popover "Grupos de finanças". Fecha em clique
 * fora, Esc ou ao escolher; a escolha persiste em localStorage['y2p-grupo'].
 */
export function GroupMenu({ name, initial }: { name: string; initial: string }) {
  const router = useRouter();
  const { t } = useFamily();
  const d = t.dock;
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const wrap = useRef<HTMLDivElement>(null);
  const group = useSyncExternalStore(onGroupChange, readGroup, readGroupServer);
  const current = GROUPS.find((g) => g.id === group) ?? GROUPS[0];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  function choose(id: GroupId) {
    writeGroup(id);
    setOpen(false);
    setToast(d.groupShown(GROUPS.find((g) => g.id === id)?.name ?? ''));
  }

  return (
    <div ref={wrap} style={{ position: 'relative', display: 'flex' }}>
      {open && (
        <div className="dk-grp" role="menu" aria-label={d.groupsTitle}>
          <div className="dk-gh">
            <b>{d.groupsTitle}</b>
            <span>{d.groupsCount(GROUPS.length)}</span>
          </div>
          {GROUPS.map((g) => {
            const on = g.id === group;
            return (
              <button key={g.id} type="button" className="dk-g" role="menuitemradio" aria-checked={on} onClick={() => choose(g.id)}>
                <span className="dk-gi">{g.initials}</span>
                <span className="dk-gt">
                  <b>{g.name}</b>
                  <em>{g.meta}</em>
                </span>
                {on ? (
                  <span className="dk-ck">
                    <DockIcon name="check" size={16} />
                  </span>
                ) : (
                  <span className="dk-gm">{g.balance}</span>
                )}
              </button>
            );
          })}
          <div className="dk-gs" />
          <button
            type="button"
            className="dk-ga"
            role="menuitem"
            onClick={() => {
              setOpen(false);
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
              setOpen(false);
              router.push('/conta');
            }}
          >
            <DockIcon name="cog" size={16} />
            {d.myAccount}
          </button>
        </div>
      )}
      <button
        type="button"
        className="dk-acct"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={d.switchGroup}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dk-av">{initial}</span>
        <span className="dk-us">
          <b>{name}</b>
          <em>{current.name}</em>
        </span>
        <DockIcon name="down" size={14} />
      </button>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 110,
          transform: `translate(-50%, ${toast ? 0 : 16}px)`,
          opacity: toast ? 1 : 0,
          pointerEvents: 'none',
          transition: '.25s',
          background: 'var(--fam-card, #1b1d21)',
          border: '1px solid var(--fx-border-strong, #3a3d42)',
          borderRadius: 12,
          padding: '11px 16px',
          fontSize: 13.5,
          color: 'var(--fx-text-strong, #edeff1)',
          boxShadow: '0 18px 44px rgba(0,0,0,.35)',
          whiteSpace: 'nowrap',
        }}
      >
        {toast}
      </div>
    </div>
  );
}
