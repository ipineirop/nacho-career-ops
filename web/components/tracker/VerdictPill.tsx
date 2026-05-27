/**
 * VerdictPill — uses the `.verdict.{code}` classes from globals.css
 * (Tracker v0.2 source lines 502–565, ported under `.tracker-list`).
 *
 * Glyph + locale italic class. Null fallback renders nothing so callers
 * can branch on presence cleanly.
 */

import { VERDICT_WORDS, type VerdictCode, type Locale } from '@/lib/brief/i18n';

interface VerdictPillProps {
  verdict: VerdictCode | null | undefined;
  locale?: Locale;
}

export function VerdictPill({ verdict, locale = 'en' }: VerdictPillProps) {
  if (!verdict || !(verdict in VERDICT_WORDS)) return null;
  const v = verdict as VerdictCode;
  const label = VERDICT_WORDS[v][locale];
  return (
    <span className={`verdict ${v}${locale === 'es' ? ' verdict-es' : ''}`}>
      {label}
    </span>
  );
}
