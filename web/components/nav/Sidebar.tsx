'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

// Evaluate is reached via the persistent FAB (per the v1 Evaluate spec), not a
// sidebar item — there is no dedicated /evaluate input page anymore.
const NAV_ITEMS = [
  { href: '/tracker',  label: 'Tracker' },
  { href: '/settings', label: 'Settings' },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) => {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  };

  return (
    <aside
      className="hidden lg:flex h-screen w-[240px] flex-col border-r"
      style={{
        background: 'var(--lm-surface-2)',
        borderColor: 'var(--lm-line)',
        flexShrink: 0,
        padding: '24px 16px 20px',
      }}
    >
      {/* Brand */}
      <div style={{ padding: '0 4px' }}>
        <span
          className="font-editorial text-[22px] leading-none"
          style={{ color: 'var(--lm-ink)' }}
        >
          labra<span style={{ color: 'var(--lm-accent)', fontStyle: 'italic' }}>.</span>
        </span>
      </div>

      {/* Nav */}
      <nav
        className="flex flex-col gap-[4px]"
        style={{ marginTop: '32px' }}
      >
        {NAV_ITEMS.map(({ href, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="block px-3 py-[10px] rounded-[10px] text-[14px] transition-all"
              style={{
                fontFamily: 'var(--font-albert-sans)',
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--lm-surface)' : 'var(--lm-ink-2)',
                background: active ? 'var(--lm-ink)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'var(--lm-canvas)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--lm-ink)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--lm-ink-2)';
                }
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User section */}
      {session && (
        <div style={{ padding: '0 4px' }}>
          <div
            style={{
              height: '0.5px',
              background: 'var(--lm-line)',
              margin: '0 -4px 16px',
            }}
          />
          <div
            className="text-[14px] font-medium leading-[1.2]"
            style={{ color: 'var(--lm-ink)' }}
          >
            {session.user?.name}
          </div>
          <div
            className="mt-1 text-[11px]"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              color: 'var(--lm-ink-3)',
              letterSpacing: '0.2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {session.user?.email}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="mt-3 text-[13px] transition-colors"
            style={{ color: 'var(--lm-ink-3)', cursor: 'pointer', border: 'none', background: 'none', padding: 0, fontFamily: 'var(--font-albert-sans)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--lm-ink)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--lm-ink-3)';
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
