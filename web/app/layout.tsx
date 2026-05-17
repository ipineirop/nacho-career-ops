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
  title: 'leadme.',
  description: 'Your AI job search companion — less noise, more signal.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className={`${geistMono.variable} ${albertSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="h-full">
        <Providers>
          {session ? (
            <div className="flex h-full flex-col lg:flex-row">
              {/* Desktop sidebar */}
              <Sidebar />
              {/* Mobile top bar */}
              <MobileHeader />
              {/* Main content — on mobile add bottom padding for the nav bar */}
              <main
                className="flex-1 overflow-auto pb-[64px] lg:pb-0"
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
