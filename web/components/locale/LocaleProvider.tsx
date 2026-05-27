'use client';

/**
 * LocaleProvider — app-wide source of truth for the user's locale during
 * a session. Seeded server-side from `users.locale` and exposed via the
 * useLocale() hook to any client component that wants to render the
 * matching bilingual string.
 *
 * Why a context: the design specs an instant locale switch via the global
 * nav toggle (handoff §4 "Instant locale switch"). State has to live above
 * any surface that consumes it, so the Brief, future Settings/Tracker, and
 * the toggle all stay in sync without re-fetching.
 *
 * Persistence is fire-and-forget — the optimistic UI flips immediately
 * and the POST happens in the background. If it fails the local state
 * still reflects the user's intent for the rest of the session; the DB
 * will catch up on the next successful flip or next session.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { normalizeLocale as _normalizeLocale, type Locale } from './locale-utils';

// Re-exported for backwards compat with imports that don't know about the
// utils split.
export const normalizeLocale = _normalizeLocale;
export type { Locale };

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    if (next === locale) return;
    // Optimistic flip; persist in the background. Errors are logged but
    // do not roll back — the user's most recent click wins for this
    // session even if the DB write loses connectivity.
    setLocaleState(next);
    void fetch('/api/preferences/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: next }),
      credentials: 'same-origin',
    }).catch((err) => {
      console.error('locale persist failed:', err);
    });
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Defensive default — if a tree mounts the toggle without the provider,
    // we surface ES (the app default) rather than crash. Logs a warning so
    // dev catches it before prod.
    if (typeof window !== 'undefined') {
      console.warn('useLocale called outside LocaleProvider; defaulting to es');
    }
    return { locale: 'es', setLocale: () => {} };
  }
  return ctx;
}
