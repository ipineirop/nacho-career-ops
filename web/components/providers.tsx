'use client';

import { SessionProvider } from 'next-auth/react';
import { EvaluationsProvider } from '@/contexts/EvaluationsContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <EvaluationsProvider>
        {children}
      </EvaluationsProvider>
    </SessionProvider>
  );
}
