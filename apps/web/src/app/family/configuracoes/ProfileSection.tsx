'use client';

import React, { useEffect, useRef, useState } from 'react';
import { C, CHROME_SHADOW, cardLabel } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import type { FamilyLang } from '../_lib/familyI18n';
import { GhostPill, PillGroup } from '../_components/FamilyUI';

/** Perfil: foto, nome, contatos verificados e idioma da interface. */
export function ProfileSection() {
  const { t, state, patch, lang, setLang } = useFamily();
  const [name, setName] = useState(state.profile.name);
  const [phone, setPhone] = useState(state.profile.phone);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function save() {
    setStatus('saving');
    timers.current.push(
      setTimeout(() => {
        patch({ profile: { ...state.profile, name: name.trim() || state.profile.name, phone } });
        setStatus('saved');
        timers.current.push(setTimeout(() => setStatus('idle'), 2200));
      }, 700),
    );
  }

  const readOnlyBox: React.CSSProperties = {
    background: C.wellDeep,
    border: `1px dashed ${C.border}`,
    borderRadius: 12,
    padding: '12px 14px',
    color: C.text3,
    fontSize: 15,
  };
  const input: React.CSSProperties = {
    width: '100%',
    maxWidth: 420,
    background: C.well,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: '12px 14px',
    color: C.textStrong,
    fontSize: 15,
    outline: 'none',
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 26 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.textStrong, letterSpacing: '-.01em' }}>
        {t.settings.profileTitle}
      </div>

      <div
        style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20, flexWrap: 'wrap' }}
      >
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: C.tile,
            border: `1px solid ${C.borderMetal}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: C.mono,
            fontSize: 22,
            color: C.silverBright,
          }}
        >
          {state.profile.hasPhoto ? '🙂' : state.profile.name.trim().charAt(0).toUpperCase() || 'A'}
        </span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <GhostPill
            mono={false}
            style={{ fontSize: 13.5 }}
            onClick={() => patch({ profile: { ...state.profile, hasPhoto: true } })}
          >
            {state.profile.hasPhoto ? t.settings.photoChange : t.settings.photoUpload}
          </GhostPill>
          {state.profile.hasPhoto && (
            <button
              type="button"
              className="fam-quiet"
              onClick={() => patch({ profile: { ...state.profile, hasPhoto: false } })}
              style={{
                fontFamily: 'inherit',
                fontSize: 13.5,
                color: C.text2,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '9px 6px',
              }}
            >
              {t.settings.photoRemove}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 24 }}>
        <div>
          <label htmlFor="cfg-nome" style={{ ...cardLabel, display: 'block', marginBottom: 8 }}>
            {t.settings.nameLabel}
          </label>
          <input
            id="cfg-nome"
            className="fam-field"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />
        </div>

        <div>
          <div style={{ ...cardLabel, marginBottom: 8 }}>{t.settings.emailLabel}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ ...readOnlyBox, maxWidth: 420, flex: '1 1 260px' }}>
              {state.profile.email}
            </span>
            <span style={{ fontSize: 12.5, color: C.text4, maxWidth: 260, lineHeight: 1.5 }}>
              {t.settings.emailNote}
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="cfg-tel" style={{ ...cardLabel, display: 'block', marginBottom: 8 }}>
            {t.settings.phoneLabel}
          </label>
          <input
            id="cfg-tel"
            className="fam-field"
            type="text"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.settings.phonePlaceholder}
            style={{ ...input, fontFamily: C.mono, fontSize: 14.5 }}
          />
        </div>

        <div>
          <div style={{ ...cardLabel, marginBottom: 8 }}>{t.settings.cpfLabel}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ ...readOnlyBox, fontFamily: C.mono, fontSize: 14.5 }}>
              {state.profile.cpfMask}
            </span>
            <span style={{ fontSize: 12.5, color: C.text4 }}>{t.settings.cpfNote}</span>
          </div>
        </div>

        <div>
          <div style={{ ...cardLabel, marginBottom: 8 }}>{t.settings.langLabel}</div>
          <PillGroup
            ariaLabel={t.settings.langLabel}
            options={[
              { value: 'pt', label: t.settings.langPt },
              { value: 'en', label: t.settings.langEn },
            ]}
            value={lang}
            onChange={(v) => setLang(v as FamilyLang)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
          <button
            type="button"
            className="btn-shine"
            onClick={save}
            disabled={status === 'saving'}
            style={{
              fontFamily: 'inherit',
              fontSize: 14.5,
              fontWeight: 600,
              color: C.chromeInk,
              background: C.chromeSoft,
              border: 'none',
              borderRadius: 12,
              padding: '12px 22px',
              cursor: status === 'saving' ? 'progress' : 'pointer',
              boxShadow: CHROME_SHADOW,
            }}
          >
            {status === 'saving' ? t.settings.saving : t.settings.save}
          </button>
          {status === 'saved' && (
            <span style={{ fontSize: 13.5, color: C.silver }}>{t.settings.saved}</span>
          )}
        </div>
      </div>
    </div>
  );
}
