'use client';

/**
 * LocaleToggle — segmented EN/ES pill exactly as specified in DS v2
 * §17.5 `.locale-toggle`. Lives in global navigation chrome, not in
 * Settings: every surface can reach it.
 *
 * Exact spec (do not adjust without re-reading DS v2):
 *   container — 1px line border, surface bg, 5px padding, 999px radius
 *   button    — 4px 14px padding, Geist Mono 11px, 1.4px tracking, 500
 *               weight, uppercase, ink-3 text by default, ink-bg fill +
 *               surface-color text when active. No hover color change —
 *               only a 150ms bg/color transition handles the active flip.
 */

import { useLocale, type Locale } from './LocaleProvider';

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <div
      role="tablist"
      aria-label="Language"
      className="inline-flex items-center gap-[2px] rounded-pill border border-line bg-surface p-[5px]"
    >
      <Pill active={locale === 'en'} label="EN" onClick={() => setLocale('en' as Locale)} />
      <Pill active={locale === 'es'} label="ES" onClick={() => setLocale('es' as Locale)} />
    </div>
  );
}

function Pill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      // The DS demo uses `padding: 4px 14px` literally — there are no
      // tokens at 14px in the s1..s7 scale (rule 04), so the value is
      // arbitrary literal here, exactly as the design system shipped it.
      style={{
        padding: '4px 14px',
        letterSpacing: '1.4px',
        transition: 'background .15s, color .15s',
      }}
      className={[
        'inline-flex items-center justify-center rounded-pill cursor-pointer border-0 font-mono text-[11px] uppercase font-medium',
        active ? 'bg-ink text-bg' : 'bg-transparent text-ink-3',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
