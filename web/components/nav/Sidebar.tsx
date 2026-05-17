'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/pipeline',  label: 'Discover',   badge: null },
  { href: '/',          label: 'Home',       badge: null },
  { href: '/tracker',   label: 'Tracker',    badge: null },
  { href: '/cv',        label: 'Tailor',     badge: null },
  { href: '/prep',      label: 'Prep',       badge: null },
  { href: '/outreach',  label: 'Outreach',   badge: null },
  { href: '/gmail',     label: 'Inbox',      badge: null },
  { href: '/calendar',  label: 'Interviews', badge: null },
] as const;

function getInitials(name?: string | null) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside
      className="hidden lg:flex h-screen w-[220px] flex-col border-r"
      style={{
        background: 'var(--lm-canvas)',
        borderColor: 'var(--lm-line)',
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div className="px-[22px] pt-[22px] pb-[18px]">
        <span
          className="font-editorial text-[22px] leading-none"
          style={{ color: 'var(--lm-ink)' }}
        >
          leadme<span style={{ color: 'var(--lm-accent)' }}>.</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-[4px] px-[8px]">
        {NAV_ITEMS.map(({ href, label, badge }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center justify-between px-[10px] py-[8px] rounded-[8px] text-[13.5px] font-medium transition-colors',
                active
                  ? 'font-ui'
                  : 'font-ui hover:bg-white/60'
              )}
              style={{
                background: active ? 'var(--lm-ink)' : undefined,
                color: active ? 'var(--lm-bg)' : 'var(--lm-ink-2)',
              }}
            >
              {label}
              {badge != null && (
                <span
                  className="font-mono-data text-[10px] px-[7px] rounded-full leading-[18px]"
                  style={{
                    background: active ? 'rgba(255,255,255,0.15)' : 'var(--lm-accent-soft)',
                    color: active ? 'white' : 'var(--lm-accent)',
                  }}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Settings */}
        <Link
          href="/settings"
          className={cn(
            'flex items-center px-[10px] py-[8px] rounded-[8px] text-[13.5px] font-medium font-ui transition-colors hover:bg-white/60'
          )}
          style={{
            background: pathname === '/settings' ? 'var(--lm-ink)' : undefined,
            color: pathname === '/settings' ? 'var(--lm-bg)' : 'var(--lm-ink-2)',
          }}
        >
          Settings
        </Link>

        {/* ✦ Evaluate CTA */}
        <Link
          href="/evaluate"
          className="mt-[8px] flex items-center justify-center gap-[6px] text-[13px] font-semibold font-ui transition-colors"
          style={{
            background: pathname === '/evaluate' ? 'var(--lm-accent-h)' : 'var(--lm-accent)',
            color: 'var(--lm-accent-on)',
            borderRadius: '10px',
            padding: '9px 16px',
            outline: pathname === '/evaluate' ? '2px solid var(--lm-accent)' : undefined,
            outlineOffset: pathname === '/evaluate' ? '2px' : undefined,
          }}
        >
          <span style={{ fontSize: 11 }}>✦</span>
          Evaluate
        </Link>
      </nav>

      {/* User section */}
      {session && (
        <div
          className="mx-[8px] mb-[14px] mt-[8px] flex items-center gap-[10px] pt-[10px]"
          style={{ borderTop: '1px solid var(--lm-line)' }}
        >
          {/* People avatar — circle */}
          <div
            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold font-ui"
            style={{ background: 'var(--lm-signal-soft)', color: 'var(--lm-signal)' }}
          >
            {getInitials(session.user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium" style={{ color: 'var(--lm-ink)' }}>
              {session.user?.name?.split(' ')[0] ?? 'You'}
            </p>
            <p className="truncate text-[11px] font-mono-data uppercase tracking-wide" style={{ color: 'var(--lm-ink-3)' }}>
              leverage
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="text-[11px] font-ui transition-colors shrink-0"
            style={{ color: 'var(--lm-ink-3)' }}
            title="Sign out"
          >
            out
          </button>
        </div>
      )}
    </aside>
  );
}
