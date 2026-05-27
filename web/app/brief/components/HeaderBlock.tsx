'use client';

/**
 * Masthead — exact match to `Labra Brief.html` lines 247-269.
 *
 *   .mast       → padding-bottom 14px, border-bottom 1px line, margin-bottom 28px,
 *                 flex, align-items: flex-end, justify-content: space-between, gap 24px
 *   .mast .left → flex column, gap 6px (meta line + h1)
 *   .mast .meta → mono 11px, letter-spacing 1.3px, uppercase, ink-3
 *   .mast h1    → Fraunces 48px / 1 / 400, letter-spacing -1.2px, ink
 *   .mast h1 em → italic
 *   .mast .right→ mono 10.5px, letter-spacing 1.2px, uppercase, ink-3,
 *                 text-align right, line-height 1.5, two lines via <br/>
 *
 * Right-meta content per locale (source lines 1164-1167):
 *   EN: "06:14 · Mexico City" / "last refresh · 2 min"
 *   ES: "06:14 · CDMX"        / "última actualización · 2 min"
 *  The ES variant uses the city CODE (CDMX), not the full name.
 */

import { useEffect, useState } from 'react';
import type { BriefMasthead } from '@/lib/brief/types';
import { formatMastheadDate } from '@/lib/brief/formatters';
import { type Locale } from './text';

export function HeaderBlock({
  masthead,
  locale,
}: {
  masthead: BriefMasthead;
  locale: Locale;
}) {
  // Compose date strings per locale.
  const date = new Date(masthead.date + 'T00:00:00');
  const dateFormatted = formatMastheadDate(date);
  const kicker = `№ ${masthead.issueNumber} · ${locale === 'en' ? dateFormatted.en : dateFormatted.es} · ${masthead.location}`;

  // Headline: "Today's <em>brief</em>." / "El <em>brief</em> de hoy."
  const headlineEn = (
    <>
      Today&apos;s <em style={{ fontStyle: 'italic' }}>brief</em>.
    </>
  );
  const headlineEs = (
    <>
      El <em style={{ fontStyle: 'italic' }}>brief</em> de hoy.
    </>
  );

  return (
    <header
      style={{
        paddingBottom: '14px',
        borderBottom: '1px solid var(--lm-line)',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '24px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span
          className="font-mono uppercase text-ink-3"
          style={{ fontSize: '11px', letterSpacing: '1.3px' }}
        >
          {kicker}
        </span>
        <h1
          className="font-serif text-ink m-0"
          style={{
            fontSize: '48px',
            lineHeight: 1,
            fontWeight: 400,
            letterSpacing: '-1.2px',
          }}
        >
          {locale === 'en' ? headlineEn : headlineEs}
        </h1>
      </div>
      <RightMeta masthead={masthead} locale={locale} />
    </header>
  );
}

function RightMeta({ masthead, locale }: { masthead: BriefMasthead; locale: Locale }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  const generated = new Date(masthead.generatedAt);
  const elapsed = Math.max(0, Math.floor((now.getTime() - generated.getTime()) / 60_000));
  const refreshValue =
    elapsed < 60 ? `${elapsed} min` :
    elapsed < 1440 ? `${Math.floor(elapsed / 60)} hr` :
    `${Math.floor(elapsed / 1440)} d`;

  // ES uses the city code (CDMX). EN uses the full city name (Mexico City).
  const cityFirstLine = locale === 'en'
    ? (masthead.cityName || masthead.location)
    : masthead.location;
  const refreshLabel = locale === 'en' ? 'last refresh' : 'última actualización';

  return (
    <span
      className="font-mono uppercase text-ink-3"
      style={{
        fontSize: '10.5px',
        letterSpacing: '1.2px',
        textAlign: 'right',
        lineHeight: 1.5,
      }}
    >
      {hh}:{mm} · {cityFirstLine}
      <br />
      {refreshLabel} · {refreshValue}
    </span>
  );
}
