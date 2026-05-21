'use client';

import { useState } from 'react';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '#evaluate', label: 'Evaluate' },
  { href: '#tracker', label: 'Tracker' },
  { href: '#settings', label: 'Settings' },
];

export default function LabraNavPreview() {
  const [activePage, setActivePage] = useState('evaluate');
  const [showUserSheet, setShowUserSheet] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* DESKTOP SIDEBAR */}
      <aside
        className="hidden lg:flex w-[240px] flex-col border-r"
        style={{
          background: 'var(--lm-surface-2, #fafcfc)',
          borderColor: 'var(--lm-line, #e2e7e8)',
          padding: '24px 16px 20px',
        }}
      >
        {/* Brand */}
        <div style={{ padding: '0 4px' }}>
          <span
            className="font-serif text-[22px] leading-none font-medium"
            style={{
              color: 'var(--lm-ink, #0a1f24)',
              fontFamily: 'var(--font-fraunces, Georgia), serif',
            }}
          >
            labra<span style={{ color: 'var(--lm-accent, #0d7c89)', fontStyle: 'italic' }}>.</span>
          </span>
        </div>

        {/* Nav */}
        <nav style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.map(({ href, label }) => (
            <button
              key={href}
              onClick={() => setActivePage(label.toLowerCase())}
              className="text-left px-3 py-[10px] rounded-[10px] text-[14px] transition-all"
              style={{
                fontFamily: 'var(--font-albert-sans, system-ui), sans-serif',
                fontWeight: activePage === label.toLowerCase() ? 500 : 400,
                color: activePage === label.toLowerCase() ? 'var(--lm-surface, #fff)' : 'var(--lm-ink-2, #455258)',
                background: activePage === label.toLowerCase() ? 'var(--lm-ink, #0a1f24)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User section */}
        <div style={{ padding: '0 4px' }}>
          <div
            style={{
              height: '0.5px',
              background: 'var(--lm-line, #e2e7e8)',
              margin: '0 -4px 16px',
            }}
          />
          <div
            className="text-[14px] font-medium leading-[1.2]"
            style={{
              color: 'var(--lm-ink, #0a1f24)',
              fontFamily: 'var(--font-albert-sans, system-ui), sans-serif',
            }}
          >
            Demo User
          </div>
          <div
            className="mt-1 text-[11px]"
            style={{
              fontFamily: 'var(--font-geist-mono, monospace)',
              color: 'var(--lm-ink-3, #889399)',
              letterSpacing: '0.2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            demo@labra.local
          </div>
          <button
            className="mt-3 text-[13px] transition-colors"
            style={{
              color: 'var(--lm-ink-3, #889399)',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              padding: 0,
              fontFamily: 'var(--font-albert-sans, system-ui), sans-serif',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--lm-ink, #0a1f24)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--lm-ink-3, #889399)';
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header
        className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between border-b"
        style={{
          background: 'var(--lm-surface, #ffffff)',
          borderColor: 'var(--lm-line, #e2e7e8)',
          height: '48px',
          padding: '0 16px',
        }}
      >
        <span
          className="font-serif text-[19px] leading-none"
          style={{
            color: 'var(--lm-ink, #0a1f24)',
            fontFamily: 'var(--font-fraunces, Georgia), serif',
            fontWeight: 500,
          }}
        >
          labra<span style={{ color: 'var(--lm-accent, #0d7c89)', fontStyle: 'italic' }}>.</span>
        </span>

        <button
          onClick={() => setShowUserSheet(!showUserSheet)}
          className="flex items-center justify-center rounded-full text-[12px] font-medium"
          style={{
            width: '32px',
            height: '32px',
            background: 'var(--lm-canvas, #f0f4f4)',
            color: 'var(--lm-ink-2, #455258)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-albert-sans, system-ui), sans-serif',
          }}
        >
          DU
        </button>
      </header>

      {/* MOBILE USER SHEET */}
      {showUserSheet && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-30"
            style={{
              background: 'rgba(10,31,36,0.42)',
              top: '48px',
            }}
            onClick={() => setShowUserSheet(false)}
          />
          <div
            className="lg:hidden fixed bottom-0 inset-x-0 z-40"
            style={{
              background: 'var(--lm-surface, #ffffff)',
              borderTopLeftRadius: '18px',
              borderTopRightRadius: '18px',
              padding: '14px 18px 20px',
              boxShadow: '0 -10px 30px rgba(10,31,36,0.12)',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '4px',
                borderRadius: '2px',
                background: 'var(--lm-line, #e2e7e8)',
                margin: '0 auto 14px',
              }}
            />
            <div
              className="text-[16px] font-medium leading-[1.2]"
              style={{
                color: 'var(--lm-ink, #0a1f24)',
                fontFamily: 'var(--font-albert-sans, system-ui), sans-serif',
              }}
            >
              Demo User
            </div>
            <div
              className="mt-[6px] text-[12px]"
              style={{
                fontFamily: 'var(--font-geist-mono, monospace)',
                color: 'var(--lm-ink-3, #889399)',
                letterSpacing: '0.2px',
              }}
            >
              demo@labra.local
            </div>
            <div
              style={{
                height: '0.5px',
                background: 'var(--lm-line, #e2e7e8)',
                margin: '14px -18px',
              }}
            />
            <button
              className="w-full py-[10px] text-left text-[15px]"
              style={{
                color: 'var(--lm-ink, #0a1f24)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-albert-sans, system-ui), sans-serif',
              }}
            >
              Sign out
            </button>
          </div>
        </>
      )}

      {/* MAIN CONTENT */}
      <main
        className="flex-1 overflow-auto pb-[56px] lg:pb-0 pt-[48px] lg:pt-0"
        style={{
          background: 'var(--lm-bg, #f6f8f8)',
          padding: '56px 64px',
        }}
      >
        <div
          className="text-[10.5px] font-mono uppercase tracking-[1.4px]"
          style={{
            color: 'var(--lm-ink-3, #889399)',
            marginBottom: '12px',
          }}
        >
          {activePage}
        </div>
        <h1
          className="font-serif text-[44px] leading-[1.05] m-0"
          style={{
            color: 'var(--lm-ink, #0a1f24)',
            fontFamily: 'var(--font-fraunces, Georgia), serif',
            fontWeight: 400,
            letterSpacing: '-1.2px',
          }}
        >
          {activePage === 'evaluate' && 'Verdict in <15s.'}
          {activePage === 'tracker' && 'Every role, one log.'}
          {activePage === 'settings' && 'Your profile, plainly.'}
        </h1>
        <p
          className="text-[15px] mt-[14px] max-w-[540px]"
          style={{
            color: 'var(--lm-ink-2, #455258)',
            fontFamily: 'var(--font-albert-sans, system-ui), sans-serif',
            lineHeight: '1.55',
          }}
        >
          {activePage === 'evaluate' && 'Paste a recruiter message, a job description, a URL.'}
          {activePage === 'tracker' && 'Track every opportunity from first contact to offer.'}
          {activePage === 'settings' && 'Manage your profile and preferences.'}
        </p>
      </main>

      {/* MOBILE BOTTOM TAB BAR */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex border-t"
        style={{
          background: 'var(--lm-surface, #ffffff)',
          borderColor: 'var(--lm-line, #e2e7e8)',
          height: '56px',
        }}
      >
        {NAV_ITEMS.map(({ href, label }) => (
          <button
            key={href}
            onClick={() => setActivePage(label.toLowerCase())}
            className="flex flex-1 items-center justify-center text-[13px]"
            style={{
              fontFamily: 'var(--font-albert-sans, system-ui), sans-serif',
              fontWeight: activePage === label.toLowerCase() ? 500 : 400,
              color: activePage === label.toLowerCase() ? 'var(--lm-ink, #0a1f24)' : 'var(--lm-ink-3, #889399)',
              textDecoration: 'none',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
