'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

function getInitials(name?: string | null) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function MobileHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showUserSheet, setShowUserSheet] = useState(false);

  if (!session) return null;
  // Onboarding has its own header (brand + step indicator + lang/theme) — skip the global chrome.
  if (pathname?.startsWith('/onboarding') || pathname?.startsWith('/auth')) return null;

  return (
    <>
      <header
        className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b"
        style={{
          background: 'var(--lm-surface)',
          borderColor: 'var(--lm-line)',
          height: '48px',
          padding: '0 16px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <span
          className="font-editorial text-[19px] leading-none"
          style={{ color: 'var(--lm-ink)' }}
        >
          labra<span style={{ color: 'var(--lm-accent)', fontStyle: 'italic' }}>.</span>
        </span>

        <button
          onClick={() => setShowUserSheet(!showUserSheet)}
          className="flex items-center justify-center rounded-full text-[12px] font-medium"
          style={{
            width: '32px',
            height: '32px',
            background: 'var(--lm-canvas)',
            color: 'var(--lm-ink-2)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-albert-sans)',
          }}
          title="Account menu"
        >
          {getInitials(session.user?.name)}
        </button>
      </header>

      {/* Scrim */}
      {showUserSheet && (
        <div
          className="lg:hidden fixed inset-0 z-30"
          style={{
            background: 'rgba(10,31,36,0.42)',
            top: '48px',
          }}
          onClick={() => setShowUserSheet(false)}
        />
      )}

      {/* Bottom sheet */}
      {showUserSheet && (
        <div
          className="lg:hidden fixed bottom-0 inset-x-0 z-40"
          style={{
            background: 'var(--lm-surface)',
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
              background: 'var(--lm-line)',
              margin: '0 auto 14px',
            }}
          />
          <div
            className="text-[16px] font-medium leading-[1.2]"
            style={{ color: 'var(--lm-ink)', fontFamily: 'var(--font-albert-sans)' }}
          >
            {session.user?.name}
          </div>
          <div
            className="mt-[6px] text-[12px]"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              color: 'var(--lm-ink-3)',
              letterSpacing: '0.2px',
            }}
          >
            {session.user?.email}
          </div>
          <div
            style={{
              height: '0.5px',
              background: 'var(--lm-line)',
              margin: '14px -18px',
            }}
          />
          <button
            onClick={() => {
              setShowUserSheet(false);
              // Will be handled by next-auth signOut
              const form = document.createElement('form');
              form.method = 'POST';
              form.action = '/api/auth/signout';
              document.body.appendChild(form);
              form.submit();
            }}
            className="w-full py-[10px] text-left text-[15px]"
            style={{
              color: 'var(--lm-ink)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-albert-sans)',
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </>
  );
}
