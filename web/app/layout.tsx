import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Sidebar } from '@/components/nav/Sidebar';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'career-ops',
  description: 'Personal job search dashboard',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full">
        <Providers>
          {session ? (
            <div className="flex h-full">
              <Sidebar />
              <main className="flex-1 overflow-auto bg-background">{children}</main>
            </div>
          ) : (
            children
          )}
        </Providers>
      </body>
    </html>
  );
}
