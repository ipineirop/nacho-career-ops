import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import { Albert_Sans, Fraunces } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Sidebar } from '@/components/nav/Sidebar';
import { MobileHeader } from '@/components/nav/MobileHeader';
import { MobileNav } from '@/components/nav/MobileNav';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { neon } from '@neondatabase/serverless';

const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const albertSans = Albert_Sans({
  variable: '--font-albert-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  weight: 'variable',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'labra.',
  description: 'Your thinking partner for career decisions.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV === 'development';
  const session = isDev ? { user: { name: 'Demo User', email: 'demo@labra.local' } } : await getServerSession(authOptions);

  // Gate: a freshly signed-in user with no completed onboarding goes straight
  // to /onboarding and sees nothing else (no tracker, no home, no evaluate).
  if (session && !isDev) {
    const hdrs = await headers();
    const pathname = hdrs.get('x-pathname') || '';
    const exempt =
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/invitations');
    if (!exempt && session.user?.email) {
      try {
        const url = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
          .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
        const sql = neon(url);
        const email = session.user.email;
        const flagKey = `${email}:leadme_onboarding_complete`;
        const cvKey = `${email}:cv_content`;
        const rows = await sql`
          SELECT key FROM settings WHERE key IN (${flagKey}, ${cvKey})
        ` as Array<{ key: string }>;
        const hasFlag = rows.some((r) => r.key === flagKey);
        const hasCv = rows.some((r) => r.key === cvKey);
        if (!hasFlag && hasCv) {
          // Pre-existing user from before the gate existed — backfill the flag
          // so we don't pay this query on every page load.
          await sql`
            INSERT INTO settings (key, value, updated_at) VALUES (${flagKey}, 'true', NOW())
            ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()
          `;
        } else if (!hasFlag && !hasCv) {
          redirect('/onboarding');
        }
      } catch (err) {
        // If the gate query fails for an infra reason, fall through rather than
        // locking the user out — onboarding still works via direct nav.
        if ((err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err;
        console.error('onboarding gate query failed:', err);
      }
    }
  }

  return (
    <html lang="en" className={`${geistMono.variable} ${albertSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="h-full">
        <Providers session={session}>
          {session || isDev ? (
            <div className="flex h-full flex-col lg:flex-row">
              {/* Desktop sidebar */}
              <Sidebar />
              {/* Mobile top bar */}
              <MobileHeader />
              {/* Main content — on mobile add bottom padding for the nav bar (56px) */}
              <main
                className="flex-1 overflow-auto pb-[56px] lg:pb-0"
                style={{ background: 'var(--lm-bg)' }}
              >
                {children}
              </main>
              {/* Mobile bottom nav */}
              <MobileNav />
            </div>
          ) : (
            children
          )}
        </Providers>
      </body>
    </html>
  );
}
