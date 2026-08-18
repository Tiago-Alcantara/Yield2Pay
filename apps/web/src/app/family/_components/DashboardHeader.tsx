'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { C } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { FamilyBrand } from './FamilyUI';

/** Cabeçalho do painel: marca, atalho para os conceitos e menu da conta. */
export function DashboardHeader() {
  const router = useRouter();
  const { t, state, reset } = useFamily();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou no Esc — o menu é a única superfície flutuante da tela.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    fontSize: 14,
    color: C.text,
    background: 'none',
    border: 'none',
    padding: '10px 12px',
    borderRadius: 9,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
    transition: 'background .15s ease',
  };

  function handleLogout() {
    setOpen(false);
    reset();
    router.push('/family');
  }

  return (
    <header
      style={{
        borderBottom: `1px solid ${C.border}`,
        background: 'rgba(12,13,15,.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '14px var(--fam-gutter)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
        }}
      >
        <FamilyBrand size={18} href="/family/dashboard" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,3vw,16px)' }}>
          <Link
            href="/family/conceitos"
            className="fam-quiet"
            style={{ fontSize: 13.5, color: C.text2, textDecoration: 'none' }}
          >
            {t.dash.concepts}
          </Link>

          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                fontFamily: 'inherit',
                borderRadius: 999,
              }}
            >
              <span className="fam-hide-sm" style={{ fontSize: 14, color: C.text2 }}>
                {t.dash.hello} {state.profile.name}
              </span>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: C.tile,
                  border: `1px solid ${C.borderMetal}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: C.mono,
                  fontSize: 13,
                  color: C.silverBright,
                }}
              >
                {state.profile.name.trim().charAt(0).toUpperCase() || 'A'}
              </span>
            </button>

            {open && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: 'min(236px, calc(100vw - 2 * var(--fam-gutter)))',
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  boxShadow: '0 20px 44px rgba(0,0,0,.55)',
                  padding: 8,
                  zIndex: 60,
                }}
              >
                <Link
                  href="/family/configuracoes#perfil"
                  className="fam-menu-item"
                  style={itemStyle}
                  onClick={() => setOpen(false)}
                >
                  {t.dash.menuAccount}
                </Link>
                <Link
                  href="/family/configuracoes#assinaturas"
                  className="fam-menu-item"
                  style={itemStyle}
                  onClick={() => setOpen(false)}
                >
                  {t.dash.menuSubs}
                </Link>
                <button type="button" className="fam-menu-item" style={itemStyle} onClick={handleLogout}>
                  {t.dash.menuLogout}
                </button>
                <div style={{ height: 1, background: C.border, margin: '6px 4px' }} />
                <Link
                  href="/family/configuracoes"
                  className="fam-menu-item"
                  style={{ ...itemStyle, fontSize: 13.5, fontWeight: 600, color: C.silver }}
                  onClick={() => setOpen(false)}
                >
                  {t.dash.menuAll}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
