/**
 * StatusBadge — operational status pill for the Tracker row.
 *
 * Two modes:
 *   • Read-only: `<StatusBadge status={...} />` renders a static pill (no
 *     caret), used on surfaces like Brief Pick where status isn't editable.
 *   • Interactive: `<StatusBadge status={...} onChange={fn} />` renders a
 *     button with a `▾` caret. Clicking toggles a dropdown of the 9
 *     canonical statuses; selecting one calls `onChange` and closes the
 *     menu.
 *
 * The dropdown is locally rendered (no portal) — fine for v1; if z-index
 * fights show up with sticky headers we'll hoist it to a portal.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { PIPELINE_STATUS } from '@/lib/api/validation';
import { STATUS_LABELS, type StatusCode, type Locale } from '@/lib/brief/i18n';

interface StatusBadgeProps {
  status: StatusCode | (string & {});
  locale?: Locale;
  /** Hide the dropdown caret on read-only surfaces (e.g. Brief Pick). */
  noCaret?: boolean;
  /** When provided, the pill becomes a button with a dropdown menu. */
  onChange?: (next: StatusCode) => void | Promise<void>;
}

const STATUS_ORDER: StatusCode[] = [
  'evaluating', 'applied', 'interviewing', 'offer_pending',
  'offer_accepted', 'rejected', 'withdrew', 'passed', 'ghosted',
];

function isCanonical(s: string): s is StatusCode {
  return s in STATUS_LABELS;
}

export function StatusBadge({ status, locale = 'en', noCaret, onChange }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  // Click-outside dismiss
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  if (!isCanonical(status)) {
    return (
      <span className="statuspill" style={{ borderStyle: 'dashed' }}>
        <span className="dot" />
        {status}
      </span>
    );
  }

  const label = STATUS_LABELS[status][locale];
  const interactive = typeof onChange === 'function';

  if (!interactive) {
    return (
      <span className={`statuspill ${status}`}>
        <span className="dot" />
        {label}
        {!noCaret && <span className="caret">▾</span>}
      </span>
    );
  }

  return (
    <span ref={rootRef} className="statuspill-wrap" style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className={`statuspill ${status}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ font: 'inherit', cursor: 'pointer' }}
      >
        <span className="dot" />
        {label}
        <span className="caret">▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="statuspill-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 50,
            minWidth: 180,
            padding: 4,
            background: 'var(--lm-surface)',
            border: '1px solid var(--lm-line)',
            borderRadius: 10,
            boxShadow: '0 8px 24px -8px rgba(0,0,0,.18), 0 2px 6px -2px rgba(0,0,0,.08)',
            fontFamily: 'var(--font-albert-sans)',
            fontSize: 12.5,
          }}
        >
          {STATUS_ORDER.map((code) => {
            const selected = code === status;
            return (
              <button
                key={code}
                role="option"
                aria-selected={selected}
                type="button"
                onClick={async () => {
                  setOpen(false);
                  if (code === status) return;
                  await Promise.resolve(onChange!(code));
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  border: 0,
                  background: selected ? 'var(--lm-canvas)' : 'transparent',
                  color: 'var(--lm-ink)',
                  textAlign: 'left',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--lm-canvas)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = selected ? 'var(--lm-canvas)' : 'transparent'; }}
              >
                <span
                  aria-hidden="true"
                  className={`dot statuspill ${code}`}
                  style={{ padding: 0, background: 'transparent', border: 0, minWidth: 'auto' }}
                >
                  <span className="dot" />
                </span>
                <span>{STATUS_LABELS[code][locale]}</span>
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

// Re-export for callers that want to lift the canonical order.
export { PIPELINE_STATUS };
