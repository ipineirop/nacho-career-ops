'use client';

/**
 * Signal stack — exact match to `Labra Brief.html` lines 421-507.
 *
 *   .stack          → margin-bottom 36px; column flex
 *   .stack-head     → mono 10.5px / 1.3px tracking, uppercase, ink-3,
 *                     margin-bottom 4px, padding-bottom 10px,
 *                     border-bottom 1px line; flex baseline gap 8px.
 *                     The count is a separate <span class="n"> in ink color, weight 500.
 *
 *   .sig            → padding 22px 0, border-bottom 1px line; last child no border
 *                     (handled by SignalCard's isLast prop).
 *
 *   .more           → margin-top 12px, padding 10px 0; Albert 13px / 500, ink-2;
 *                     flex baseline gap 6px, border-bottom 1px line.
 *                     Includes a 18px monospace ic and a right-aligned count.
 */

import { useMemo, useState } from 'react';
import type { BriefSignalPayload } from '@/lib/brief/types';
import { SignalCard } from './SignalCard';
import { BRIEF_STRINGS } from '@/lib/brief/i18n';
import { pick, type Locale } from './text';

interface Props {
  visible: BriefSignalPayload[];
  collapsed: number;
  locale: Locale;
}

export function SignalStack({ visible, collapsed, locale }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const remaining = useMemo(
    () => visible.filter((s) => !hidden.has(s.id)),
    [visible, hidden],
  );

  async function persist(action: 'snooze' | 'dismiss', sig: BriefSignalPayload) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(sig.id);
      return next;
    });
    try {
      const ghost = sig.actions.ghost;
      await fetch(
        `/api/brief/signals/${encodeURIComponent(sig.id)}/${action}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            signalType: sig.type,
            durationDays: ghost?.durationDays,
          }),
        },
      );
    } catch (err) {
      console.error('SignalStack.persist failed', action, err);
    }
  }

  // Empty state — render an explicit "all quiet" block instead of vanishing
  // the section. Without this the Brief reads like a half-rendered page
  // (masthead → editor's note → empty space → pipeline summary).
  if (remaining.length === 0 && collapsed === 0) {
    return (
      <section style={{ marginBottom: '36px', display: 'flex', flexDirection: 'column' }}>
        <div
          className="font-mono uppercase text-ink-3"
          style={{
            fontSize: '10.5px',
            letterSpacing: '1.3px',
            marginBottom: '4px',
            paddingBottom: '10px',
            borderBottom: '1px solid var(--lm-line)',
          }}
        >
          {pick(BRIEF_STRINGS.signalsHeadQuiet, locale)}
        </div>
        <p
          style={{
            margin: '20px 0 0',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            lineHeight: 1.55,
            color: 'var(--lm-ink-2)',
            maxWidth: '52ch',
          }}
        >
          {pick(BRIEF_STRINGS.signalsQuietBody, locale)}
        </p>
      </section>
    );
  }

  const total = remaining.length + collapsed;

  return (
    <section style={{ marginBottom: '36px', display: 'flex', flexDirection: 'column' }}>
      <div
        className="font-mono uppercase text-ink-3"
        style={{
          fontSize: '10.5px',
          letterSpacing: '1.3px',
          marginBottom: '4px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--lm-line)',
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px',
        }}
      >
        <span>{pick(BRIEF_STRINGS.signalsHeadLabel, locale)}</span>
        <span style={{ color: 'var(--lm-ink)', fontWeight: 500 }}>
          {String(total).padStart(2, '0')}
        </span>
      </div>

      {remaining.map((sig, i) => (
        <SignalCard
          key={sig.id}
          signal={sig}
          locale={locale}
          isLast={i === remaining.length - 1 && collapsed === 0}
          onSnooze={() => persist('snooze', sig)}
          onDismiss={() => persist('dismiss', sig)}
        />
      ))}

      {collapsed > 0 && (
        <button
          type="button"
          aria-label="more signals"
          style={{
            marginTop: '12px',
            padding: '10px 0',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--lm-ink-2)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            justifyContent: 'flex-start',
            borderBottom: '1px solid var(--lm-line)',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--lm-line)',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: '18px',
              height: '18px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--lm-ink-3)',
            }}
          >
            ⌄
          </span>
          <span>
            {locale === 'en' ? 'more signals' : 'más señales'}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--lm-ink-3)',
              letterSpacing: '0.5px',
            }}
          >
            {String(collapsed).padStart(2, '0')}
          </span>
        </button>
      )}
    </section>
  );
}
