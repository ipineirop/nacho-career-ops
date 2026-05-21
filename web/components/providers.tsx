'use client';

import { SessionProvider } from 'next-auth/react';
import { EvaluationsProvider } from '@/contexts/EvaluationsContext';

export function Providers({ children, session }: { children: React.ReactNode; session: any }) {
  return (
    <SessionProvider session={session}>
      <EvaluationsProvider>
        {children}
      </EvaluationsProvider>
    </SessionProvider>
  );
}
