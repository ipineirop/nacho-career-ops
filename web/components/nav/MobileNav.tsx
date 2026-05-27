'use client';

/**
 * Mobile bottom tab bar — matches `Labra Brief.html` lines 802-816 (`.tab-m`).
 *
 *   .tab-m         → flex, border-top 1px line, padding 8px 0 14px
 *   .tab-m a       → flex 1, centered, Albert 11px / 500, ink-3 inactive
 *   .tab-m a.on    → ink color
 *   .tab-m a .ti   → 6x6 round dot ABOVE the label,
 *                    ink-3 inactive, accent on active. The dot is what
 *                    surfaces the active tab — there's no underline or
 *                    background pill, just the dot's color flip.
 *
 * Evaluate is FAB-only (root layout mount); never a tab.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/brief',    label: 'Brief' },
  { href: '/tracker',  label: 'Tracker' },
  { href: '/settings', label: 'Settings' },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  if (pathname?.startsWith('/onboarding') || pathname?.startsWith('/auth')) return null;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname?.startsWith(href) ?? false;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex"
      style={{
        background: 'var(--lm-bg)',
        borderTop: '1px solid var(--lm-line)',
        padding: '8px 0 14px',
        paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        alignItems: 'center',
        gap: 0,
      }}
    >
      {NAV_ITEMS.map(({ href, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 500,
              color: active ? 'var(--lm-ink)' : 'var(--lm-ink-3)',
              textDecoration: 'none',
              padding: '6px 0',
              display: 'block',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: active ? 'var(--lm-accent)' : 'var(--lm-ink-3)',
                margin: '0 auto 4px',
              }}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
