import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import { Albert_Sans, Fraunces } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Sidebar } from '@/components/nav/Sidebar';
import { MobileHeader } from '@/components/nav/MobileHeader';
import { MobileNav } from '@/components/nav/MobileNav';
import { EvaluatePanelProvider } from '@/components/evaluate/EvaluatePanelProvider';
import { EvaluateFab } from '@/components/evaluate/EvaluateFab';
import { EvaluatePanel } from '@/components/evaluate/EvaluatePanel';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSetting, setSetting } from '@/lib/settings-store';
import { getDb, userProfiles, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

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
        const email = session.user.email;
        const flagKey = `${email}:leadme_onboarding_complete`;
        const hasFlag = (await getSetting(flagKey)) === 'true';
        if (!hasFlag) {
          // Pre-existing user: treat a stored CV as completed onboarding so we
          // never re-gate someone who already finished, then backfill the flag.
          // user_profiles.cv_markdown is the authoritative CV signal (always on
          // Supabase); fall back to the cv_content key for older rows.
          const db = getDb();
          const prof = await db
            .select({ cv: userProfiles.cvMarkdown })
            .from(userProfiles)
            .innerJoin(users, eq(users.id, userProfiles.userId))
            .where(eq(users.email, email))
            .limit(1);
          const hasCv = !!prof[0]?.cv || !!(await getSetting(`${email}:cv_content`));
          if (hasCv) {
            await setSetting(flagKey, 'true');
          } else {
            redirect('/onboarding');
          }
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
          <EvaluatePanelProvider>
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
                {/* Evaluate FAB + panel — root overlay; the FAB hides itself on /onboarding/* and when the panel is open. */}
                <EvaluateFab />
                <EvaluatePanel />
              </div>
            ) : (
              children
            )}
          </EvaluatePanelProvider>
        </Providers>
      </body>
    </html>
  );
}
