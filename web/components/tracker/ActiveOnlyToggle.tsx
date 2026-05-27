/**
 * ActiveOnlyToggle — `.chip.toggle` from the v0.2 filter strip.
 * Rail + thumb visuals live in globals.css; this component is just the
 * state wiring.
 */

'use client';

import { TRACKER_STRINGS, type Locale } from '@/lib/brief/i18n';

interface ActiveOnlyToggleProps {
  on: boolean;
  onChange: (next: boolean) => void;
  locale?: Locale;
}

export function ActiveOnlyToggle({ on, onChange, locale = 'en' }: ActiveOnlyToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`chip toggle${on ? ' on' : ''}`}
      title={TRACKER_STRINGS.activeOnlyLabel[locale]}
    >
      <span className="rail" aria-hidden="true" />
      {TRACKER_STRINGS.activeOnlyLabel[locale]}
    </button>
  );
}
