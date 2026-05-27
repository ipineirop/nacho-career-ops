/**
 * Signal kicker — exact match to `Labra Brief.html` lines 442-454.
 *
 *   .kicker          → mono 10.5px / 1.3px tracking, uppercase, ink-3,
 *                      flex baseline gap 6px, nowrap, overflow hidden
 *   .kicker .subj    → ink color, weight 500 (the subject like "YOUR PIPELINE")
 *   .kicker .sep     → ink-3 separator dot
 *   .kicker .modifier→ italic LOWERCASE, letter-spacing 0.6px, ink-2
 *   .kicker.cold     → subj + modifier turn signal (amber)
 *   .kicker.next     → subj + modifier turn accent (petrol)
 *   trailing pieces  → entity name + timeframe in default ink-3 mono
 *
 * The parser splits the API-supplied kicker string `*LABEL* · ENTITY · TIMEFRAME`
 * into structured spans. LABEL is split further: anything before the first
 * "· word" becomes subj; the lowercase word after is the modifier.
 *
 * Examples:
 *   "*YOUR PIPELINE · cold* · MERCADO LIBRE · 9D"
 *      → subj "YOUR PIPELINE", modifier "cold", tail [MERCADO LIBRE, 9D]
 *   "*YOUR BAR* · 7 MO"
 *      → subj "YOUR BAR", no modifier, tail [7 MO]
 *   "*YOUR DRIFT* · 30D"
 *      → subj "YOUR DRIFT", no modifier, tail [30D]
 */

import type { BriefSignalPayload } from '@/lib/brief/types';
import { pick, type Locale } from './text';

const TONE_BY_TYPE: Record<BriefSignalPayload['type'], 'cold' | 'next' | 'neutral'> = {
  'pipeline.cold': 'cold',
  'pipeline.next': 'next',
  freshness: 'neutral',
  drift: 'neutral',
  bar: 'neutral',
};

interface Parsed {
  subj: string;
  modifier: string | null;
  tail: string[];
}

const LABEL_RE = /^\*([^*\n]+)\*(.*)$/;

function parseKicker(raw: string): Parsed | null {
  const m = raw.match(LABEL_RE);
  if (!m) return null;
  const labelInner = m[1].trim(); // e.g. "YOUR PIPELINE · cold"
  const tail = m[2].split('·').map((s) => s.trim()).filter(Boolean);

  // Inside the label, optionally "<SUBJ> · <modifier>" where the modifier is
  // a single lowercase word (frío, cold, siguiente, next).
  const labelParts = labelInner.split('·').map((s) => s.trim());
  if (labelParts.length >= 2) {
    return { subj: labelParts[0], modifier: labelParts.slice(1).join(' '), tail };
  }
  return { subj: labelInner, modifier: null, tail };
}

export function SignalKicker({
  kicker,
  type,
  locale,
}: {
  kicker: BriefSignalPayload['kicker'];
  type: BriefSignalPayload['type'];
  locale: Locale;
}) {
  const raw = pick(kicker, locale);
  const parsed = parseKicker(raw);
  const tone = TONE_BY_TYPE[type];

  // Color for subj + modifier based on tone.
  const chroma =
    tone === 'cold' ? 'var(--lm-signal)' :
    tone === 'next' ? 'var(--lm-accent)' :
    'var(--lm-ink)';

  const modifierChroma =
    tone === 'cold' ? 'var(--lm-signal)' :
    tone === 'next' ? 'var(--lm-accent)' :
    'var(--lm-ink-2)';

  if (!parsed) {
    return (
      <div
        className="font-mono uppercase text-ink-3"
        style={{ fontSize: '10.5px', letterSpacing: '1.3px' }}
      >
        {raw}
      </div>
    );
  }

  return (
    <div
      className="font-mono uppercase"
      style={{
        fontSize: '10.5px',
        letterSpacing: '1.3px',
        display: 'flex',
        alignItems: 'baseline',
        gap: '6px',
        color: 'var(--lm-ink-3)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span style={{ color: chroma, fontWeight: 500 }}>{parsed.subj}</span>
      {parsed.modifier && (
        <>
          <span style={{ color: 'var(--lm-ink-3)' }}>·</span>
          <span
            style={{
              color: modifierChroma,
              fontStyle: 'italic',
              textTransform: 'lowercase',
              letterSpacing: '0.6px',
            }}
          >
            {parsed.modifier}
          </span>
        </>
      )}
      {parsed.tail.map((t, i) => (
        <span key={`${t}-${i}`} style={{ display: 'inline-flex', gap: '6px' }}>
          <span style={{ color: 'var(--lm-ink-3)' }}>·</span>
          <span>{t}</span>
        </span>
      ))}
    </div>
  );
}
