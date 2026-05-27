'use client';

/**
 * Signal row — exact match to `Labra Brief.html` lines 435-486. Critical
 * deviation from my earlier build: this is NOT a card. There's no surface
 * background, no border, no card radius. Just:
 *   padding: 22px 0
 *   border-bottom: 1px solid var(--lm-line)   (last child: none — handled in stack)
 *   grid template columns 1fr, gap 10px (so kicker / body / actions stack
 *   tightly with consistent vertical rhythm)
 *
 *   .body   → Fraunces 400, 17.5px, line-height 1.5, ink
 *   .body em → italic
 *   .body b  → weight 500
 *
 *   .actions → flex gap 6px center, wrap
 *   .actions .ghost-actions → margin-left: auto, opacity 0, fades in on
 *                              hover/focus-within (transition .12s)
 *
 * Primary/secondary use `.btn.sm` (12px Albert, 6px 12px padding, line border).
 * Primary additionally gets `.primary` (accent fill).
 * Ghost actions live inside `.ghost-actions` — these are the snooze/keep
 * controls that hide until the row is hovered.
 */

import type { BriefSignalPayload } from '@/lib/brief/types';
import { pick, renderEmphasis, type Locale } from './text';
import { SignalKicker } from './SignalKicker';

interface Props {
  signal: BriefSignalPayload;
  locale: Locale;
  isLast: boolean;
  onSnooze: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
}

export function SignalCard({ signal, locale, isLast, onSnooze, onDismiss }: Props) {
  const bodyText = pick(signal.body, locale);
  const ghost = signal.actions.ghost;

  return (
    <article
      data-signal-id={signal.id}
      data-signal-type={signal.type}
      className="brief-sig"
      style={{
        padding: '22px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--lm-line)',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '10px',
      }}
    >
      <SignalKicker kicker={signal.kicker} type={signal.type} locale={locale} />

      <p
        className="font-serif text-ink m-0"
        style={{ fontSize: '17.5px', lineHeight: 1.5, fontWeight: 400 }}
      >
        {renderEmphasis(bodyText)}
      </p>

      <div
        style={{
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          marginTop: '4px',
          flexWrap: 'wrap',
        }}
      >
        <BtnSmall
          primary
          data-action={signal.actions.primary.code}
          label={pick(signal.actions.primary.label, locale)}
        />
        {signal.actions.secondary && (
          <BtnSmall
            data-action={signal.actions.secondary.code}
            label={pick(signal.actions.secondary.label, locale)}
          />
        )}
        {ghost && (
          <span
            className="brief-ghost-actions"
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: '2px',
              opacity: 0,
              transition: 'opacity .12s',
            }}
          >
            <button
              type="button"
              data-action={ghost.code}
              onClick={() => {
                if (ghost.code === 'snooze') void onSnooze();
                else if (ghost.code === 'dismiss') void onDismiss();
              }}
              style={{
                background: 'transparent',
                border: 0,
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--lm-ink-3)',
                padding: '4px 9px',
                borderRadius: '999px',
                cursor: 'pointer',
              }}
            >
              {pick(ghost.label, locale)}
            </button>
          </span>
        )}
      </div>
    </article>
  );
}

interface BtnSmallProps {
  label: string;
  primary?: boolean;
  'data-action'?: string;
}

function BtnSmall({ label, primary, ...rest }: BtnSmallProps) {
  return (
    <button
      type="button"
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '999px',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: '12px',
        cursor: 'pointer',
        border: primary ? '1px solid var(--lm-accent)' : '1px solid var(--lm-line)',
        background: primary ? 'var(--lm-accent)' : 'var(--lm-surface)',
        color: primary ? 'var(--lm-accent-on)' : 'var(--lm-ink)',
        transition: 'background .12s, border-color .12s, color .12s',
      }}
    >
      {label}
    </button>
  );
}
