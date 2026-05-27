/**
 * Tiny presentation helpers used across Brief components.
 *
 * `pick(b, locale)` — pull the locale-matching string out of the bilingual
 * `{ en, es }` shape the API returns.
 *
 * `renderEmphasis(text)` — render single-star markdown `*foo*` as `<em>`
 * inline. The linter caps these at one per language, but the renderer is
 * agnostic and just transforms whatever it gets.
 */

import type { ReactNode } from 'react';
import type { Bilingual } from '@/lib/brief/types';

export type Locale = 'en' | 'es';

export function pick(b: Bilingual | undefined | null, locale: Locale): string {
  if (!b) return '';
  return locale === 'en' ? b.en : b.es;
}

/** Render `**bold**` and `*italic*` markdown inline.
 *
 *  - `**…**` becomes `<b>` with weight 500 (DS v2 §12 — entity-name bold
 *    is medium, not heavy).
 *  - `*…*` becomes `<em>` italic.
 *
 *  We scan left-to-right matching either token; the regex preferring `**`
 *  over `*` is what disambiguates them (alternation is left-greedy).
 *  Neither span may contain `*` or newlines. */
export function renderEmphasis(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Match **bold** OR *italic* OR neither. The `**…**` alternative comes
  // first so it wins when both could match the same opening star.
  const re = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index));
    }
    const tok = m[0];
    if (tok.startsWith('**')) {
      parts.push(
        <b key={`b-${key++}`} className="font-medium">
          {tok.slice(2, -2)}
        </b>,
      );
    } else {
      parts.push(
        <em key={`em-${key++}`} className="italic">
          {tok.slice(1, -1)}
        </em>,
      );
    }
    lastIndex = m.index + tok.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
