'use client';

/**
 * Configurações — /family/configuracoes
 *
 * Sete seções numa nav lateral que vira faixa de chips no mobile. A seção ativa
 * fica no hash da URL (#perfil, #assinaturas…), como no design, para o menu do
 * painel poder linkar direto para uma delas.
 */

import React, { useEffect, useState } from 'react';
import { C } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { BackHeader } from '../_components/FamilyUI';
import { ProfileSection } from './ProfileSection';
import { SecuritySection } from './SecuritySection';
import { WalletSection } from './WalletSection';
import { PixSection } from './PixSection';
import { SubsSection } from './SubsSection';
import { NotificationsSection } from './NotificationsSection';
import { PrivacySection } from './PrivacySection';

const SECTIONS = [
  'perfil',
  'seguranca',
  'carteira',
  'pix',
  'assinaturas',
  'notificacoes',
  'privacidade',
] as const;

type Section = (typeof SECTIONS)[number];

function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

export default function FamilySettingsPage() {
  const { t } = useFamily();
  const [section, setSection] = useState<Section>('perfil');

  // O hash só existe no cliente; lemos depois da montagem e acompanhamos as
  // mudanças para o menu do painel poder linkar direto a uma seção.
  useEffect(() => {
    function syncFromHash() {
      const hash = window.location.hash.replace('#', '');
      if (isSection(hash)) setSection(hash);
    }
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  function select(next: Section) {
    setSection(next);
    window.history.replaceState(null, '', `#${next}`);
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bgRadial }}>
      <BackHeader label={t.settings.back} maxWidth={1040} />

      <main
        style={{ maxWidth: 1040, margin: '0 auto', padding: '28px var(--fam-gutter) 80px' }}
      >
        <h1
          style={{
            fontSize: 'clamp(23px,5vw,34px)',
            fontWeight: 700,
            letterSpacing: '-.025em',
            margin: 0,
            color: C.textStrong,
          }}
        >
          {t.settings.title}
        </h1>
        <p style={{ fontSize: 14.5, color: C.text2, margin: '8px 0 28px' }}>{t.settings.sub}</p>

        <div className="fam-cfg">
          <nav className="fam-cfg-nav" aria-label={t.settings.navAria}>
            {t.settings.nav.map(([id, label]) => {
              const on = section === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={on ? 'page' : undefined}
                  onClick={() => select(id as Section)}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: on ? 600 : 500,
                    textAlign: 'left',
                    color: on ? C.textStrong : C.text2,
                    background: on ? 'rgba(192,194,197,.08)' : 'none',
                    border: `1px solid ${on ? C.borderStrong : 'transparent'}`,
                    borderRadius: 10,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    transition: 'all .15s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          <div style={{ minWidth: 0 }}>
            {section === 'perfil' && <ProfileSection />}
            {section === 'seguranca' && <SecuritySection />}
            {section === 'carteira' && <WalletSection />}
            {section === 'pix' && <PixSection />}
            {section === 'assinaturas' && <SubsSection />}
            {section === 'notificacoes' && <NotificationsSection />}
            {section === 'privacidade' && <PrivacySection />}
          </div>
        </div>
      </main>
    </div>
  );
}
