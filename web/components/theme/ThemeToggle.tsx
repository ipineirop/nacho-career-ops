'use client';

/**
 * ThemeToggle — segmented LIGHT/DARK pill, mirrors the LocaleToggle's
 * visual contract from DS v2 §17.5. Drives the `.dark` class on
 * `<html>` which gates every `--lm-*` dark override + the
 * `.dark .verdict-*` adjustments in globals.css.
 *
 * Resolution order (highest precedence first):
 *   1. localStorage key `labra.theme` — user's last explicit choice
 *   2. `prefers-color-scheme: dark` media query — OS preference
 *   3. light (fallback)
 *
 * No server persistence in v1 — the OS-preference fallback handles
 * cross-device parity for most users; a per-user DB column lands in a
 * follow-up if needed.
 */

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'labra.theme';

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

function resolveInitial(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle() {
  // SSR can't know the user's OS preference, so we initialize to light
  // and reconcile on mount. The first paint may flicker briefly for
  // dark-mode users; acceptable for v1.
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const t = resolveInitial();
    setTheme(t);
    applyTheme(t);
  }, []);

  function flip(next: Theme) {
    if (next === theme) return;
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode / disabled storage — swallow */
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Theme"
      className="inline-flex items-center gap-[2px] rounded-pill border border-line bg-surface p-[5px]"
    >
      <Pill active={theme === 'light'} label="LIGHT" onClick={() => flip('light')} />
      <Pill active={theme === 'dark'} label="DARK" onClick={() => flip('dark')} />
    </div>
  );
}

function Pill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: '4px 14px',
        letterSpacing: '1.4px',
        transition: 'background .15s, color .15s',
      }}
      className={[
        'inline-flex items-center justify-center rounded-pill cursor-pointer border-0 font-mono text-[11px] uppercase font-medium',
        active ? 'bg-ink text-bg' : 'bg-transparent text-ink-3',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
