'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/pipeline': 'Discover',
  '/tracker': 'Tracker',
  '/cv': 'Tailor',
  '/prep': 'Prep',
  '/evaluate': 'Evaluate',
  '/settings': 'Settings',
  '/reports': 'Reports',
};

export function MobileHeader() {
  const pathname = usePathname();
  const label = Object.entries(ROUTE_LABELS).find(([k]) =>
    k === '/' ? pathname === '/' : pathname.startsWith(k)
  )?.[1] ?? '';

  return (
    <header
      className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b px-4"
      style={{
        background: 'var(--lm-canvas)',
        borderColor: 'var(--lm-line)',
        height: 52,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <Link href="/" style={{ textDecoration: 'none' }}>
        <span
          className="font-editorial"
          style={{ fontSize: 20, color: 'var(--lm-ink)' }}
        >
          leadme<span style={{ color: 'var(--lm-accent)' }}>.</span>
        </span>
      </Link>

      {label && (
        <span style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: 10.5, letterSpacing: '1.2px',
          textTransform: 'uppercase', color: 'var(--lm-ink-3)',
        }}>
          {label}
        </span>
      )}

      <Link
        href="/evaluate"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '6px 14px', borderRadius: 999,
          background: 'var(--lm-accent)', color: 'var(--lm-accent-on)',
          fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        <span style={{ fontSize: 9 }}>✦</span>
        Eval
      </Link>
    </header>
  );
}
