'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/pipeline',  label: 'Discover',  icon: '◉' },
  { href: '/',          label: 'Home',      icon: '⌂' },
  { href: '/tracker',   label: 'Tracker',   icon: '☰' },
  { href: '/outreach',  label: 'Outreach',  icon: '✉' },
  { href: '/cv',        label: 'Tailor',    icon: '✂' },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex border-t"
      style={{ background: 'var(--lm-canvas)', borderColor: 'var(--lm-line)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-[3px] py-[10px]"
            style={{ color: active ? 'var(--lm-accent)' : 'var(--lm-ink-3)' }}
          >
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 10, fontWeight: active ? 600 : 400, letterSpacing: '0.03em' }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
