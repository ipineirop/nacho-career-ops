'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/evaluate', label: 'Evaluate' },
  { href: '/tracker',  label: 'Tracker' },
  { href: '/settings', label: 'Settings' },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  // Onboarding and auth screens have their own navigation — skip the global tab bar.
  if (pathname?.startsWith('/onboarding') || pathname?.startsWith('/auth')) return null;

  const isActive = (href: string) => {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex border-t"
      style={{
        background: 'var(--lm-surface)',
        borderColor: 'var(--lm-line)',
        height: '56px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {NAV_ITEMS.map(({ href, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 items-center justify-center text-[13px]"
            style={{
              fontFamily: 'var(--font-albert-sans)',
              fontWeight: active ? 500 : 400,
              color: active ? 'var(--lm-ink)' : 'var(--lm-ink-3)',
              textDecoration: 'none',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
