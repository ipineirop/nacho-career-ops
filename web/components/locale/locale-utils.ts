/**
 * Locale helpers usable from both Server and Client Components. The
 * LocaleProvider component itself is 'use client' (it owns React state),
 * so anything a Server Component needs to call lives here instead.
 */

export type Locale = 'en' | 'es';

/** Normalize a stored `users.locale` value (`en`, `en-US`, `es-MX`, etc.)
 *  to the binary `Locale` we render against. */
export function normalizeLocale(raw: string | null | undefined): Locale {
  return (raw ?? '').toLowerCase().startsWith('en') ? 'en' : 'es';
}
