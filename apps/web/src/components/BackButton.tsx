'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Circular back-arrow button. Navigates to `href` (default /b2b/dashboard).
 *
 * Positioned absolutely at the left edge of its parent, so a centered
 * sibling (e.g. the Yield2Pay brand) stays visually centered. The parent
 * must be `position: relative` for this to anchor correctly.
 *
 * aria-label intentionally avoids the word "back" so it doesn't collide
 * with the in-card step "Back" buttons in tests.
 */
export function BackButton({
  href = '/b2b/dashboard',
  label = 'Return to dashboard',
}: {
  href?: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      aria-label={label}
      title={label}
      style={{
        position: 'absolute',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: 'var(--fx-surface-2)',
        border: '1px solid var(--fx-border-metal)',
        color: 'var(--fx-text-2)',
        cursor: 'pointer',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}
