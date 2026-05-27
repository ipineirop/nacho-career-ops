/**
 * Pipeline summary — exact match to `Labra Brief.html` lines 509-537.
 *
 *   .pipe        → margin-bottom 40px, padding-top 10px
 *   .pipe a      → Fraunces 19px / 1.4, ink, flex baseline gap 12px, wrap
 *   .pipe a em   → italic
 *   .pipe a .lbl → mono 10.5px / 1.3px tracking, uppercase, ink-3 (the "YOUR PIPELINE" header)
 *   .pipe .counts → inline-flex gap 18px, baseline; each .ct's <span class="n">N</span> is weight 500
 *   .pipe .arrow → Albert 14px, ink-3, margin-left auto; hover turns accent and translateX(4px)
 *   .pipe .empty → Fraunces 19px italic ink-2, flex
 *
 * EN structure: "YOUR PIPELINE   12 Pursues open · 4 Replies live · 7 Watches   Open tracker →"
 * ES structure: "TU PIPELINE     12 en *Avanza* · 4 en *Responde* · 7 en *Observa*   Abrir tracker →"
 *   (verdict words italicized via <em> in ES)
 */

import Link from 'next/link';
import type { BriefPipelineSummary } from '@/lib/brief/types';
import { BRIEF_STRINGS, VERDICT_WORDS } from '@/lib/brief/i18n';
import { pick, type Locale } from './text';

// The summary sentence the API supplies isn't structured (it's a single
// pre-formatted string). For richer rendering with separate count vs label
// styling we re-parse, falling back to the supplied sentence if anything
// goes wrong.
const COUNT_PAIR_RE = /^(\d+)\s+(.+)$/;

interface ParsedCount {
  n: string;
  label: string;
}

function parseSentence(text: string): ParsedCount[] | null {
  if (!text) return null;
  // Sentences look like "12 Pursues open · 4 Replies live · 7 Watches".
  // For ES with italics they look like "12 en *Avanza* · 4 en *Responde* · …".
  // We just split on the centered dot and pull "<n> <rest>" pairs.
  const parts = text.split('·').map((p) => p.trim()).filter(Boolean);
  const out: ParsedCount[] = [];
  for (const p of parts) {
    const m = p.match(COUNT_PAIR_RE);
    if (!m) return null;
    out.push({ n: m[1], label: m[2] });
  }
  return out.length > 0 ? out : null;
}

function renderLabel(label: string): React.ReactNode {
  // ES labels like "en *Avanza*" → "en " + <em>Avanza</em>.
  const m = label.match(/^(.*?)\*([^*]+)\*(.*)$/);
  if (!m) return label;
  return (
    <>
      {m[1]}
      <em style={{ fontStyle: 'italic' }}>{m[2]}</em>
      {m[3]}
    </>
  );
}

export function PipelineSummary({
  summary,
  locale,
}: {
  summary: BriefPipelineSummary;
  locale: Locale;
}) {
  const text = pick(summary.sentence, locale);
  const emptyText = pick(BRIEF_STRINGS.emptyPipeline, locale);
  const isEmpty = text === emptyText;

  // Layout values
  const wrapper: React.CSSProperties = {
    marginBottom: '40px',
    paddingTop: '10px',
  };

  if (isEmpty) {
    return (
      <footer style={wrapper}>
        <Link
          href={summary.trackerLink}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '12px',
            textDecoration: 'none',
            fontFamily: 'var(--font-serif)',
            fontSize: '19px',
            lineHeight: 1.4,
            fontStyle: 'italic',
            color: 'var(--lm-ink-2)',
          }}
        >
          {emptyText}
        </Link>
      </footer>
    );
  }

  const counts = parseSentence(text);

  return (
    <footer style={wrapper}>
      <Link
        href={summary.trackerLink}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
          flexWrap: 'wrap',
          textDecoration: 'none',
          fontFamily: 'var(--font-serif)',
          fontSize: '19px',
          lineHeight: 1.4,
          color: 'var(--lm-ink)',
        }}
        className="brief-pipe"
      >
        <span
          className="font-mono uppercase"
          style={{
            fontSize: '10.5px',
            letterSpacing: '1.3px',
            color: 'var(--lm-ink-3)',
          }}
        >
          {pick(BRIEF_STRINGS.pipelineLabel, locale)}
        </span>
        {counts ? (
          <span style={{ display: 'inline-flex', gap: '18px', alignItems: 'baseline', flexWrap: 'wrap' }}>
            {counts.map((c, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontWeight: 500 }}>{c.n}</span>
                <span>{renderLabel(c.label)}</span>
              </span>
            ))}
          </span>
        ) : (
          // Fallback: render the supplied sentence as-is if it didn't parse.
          <span>{text}</span>
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--lm-ink-3)',
          }}
        >
          {pick(BRIEF_STRINGS.pipelineOpenTracker, locale)}
        </span>
      </Link>
    </footer>
  );
}
