'use client';

import React from 'react';
import { C } from '../_lib/familyTheme';
import { useFamily } from '../_lib/FamilyProvider';
import { FamilySwitch } from '../_components/FamilyUI';

type ChannelKey = keyof ReturnType<typeof useFamily>['state']['notifications']['channels'];
type EventKey = keyof ReturnType<typeof useFamily>['state']['notifications']['events'];

/** Notificações: por onde avisar e sobre o quê. */
export function NotificationsSection() {
  const { t, state, patch } = useFamily();
  const { channels, events } = state.notifications;

  function toggleChannel(key: ChannelKey) {
    patch({
      notifications: {
        ...state.notifications,
        channels: { ...channels, [key]: !channels[key] },
      },
    });
  }

  function toggleEvent(key: EventKey) {
    patch({
      notifications: {
        ...state.notifications,
        events: { ...events, [key]: !events[key] },
      },
    });
  }

  const cardTitle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    color: C.textStrong,
    letterSpacing: '-.01em',
  };

  function Row({
    label,
    desc,
    checked,
    onChange,
  }: {
    label: string;
    desc: string;
    checked: boolean;
    onChange: () => void;
  }) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 0',
          borderBottom: `1px solid ${C.borderFainter}`,
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: C.text }}>
            {label}
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: C.text3, marginTop: 2 }}>
            {desc}
          </span>
        </span>
        <FamilySwitch checked={checked} onChange={onChange} aria-label={label} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 'var(--fam-card-pad)' }}>
        <div style={cardTitle}>{t.settings.channelsTitle}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
          {t.settings.channels.map(([id, label, desc]) => (
            <Row
              key={id}
              label={label}
              desc={desc}
              checked={channels[id as ChannelKey]}
              onChange={() => toggleChannel(id as ChannelKey)}
            />
          ))}
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 'var(--fam-card-pad)' }}>
        <div style={cardTitle}>{t.settings.eventsTitle}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
          {t.settings.events.map(([id, label, desc]) => (
            <Row
              key={id}
              label={label}
              desc={desc}
              checked={events[id as EventKey]}
              onChange={() => toggleEvent(id as EventKey)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
