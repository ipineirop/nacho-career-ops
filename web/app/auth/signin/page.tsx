'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">career-ops</h1>
          <p className="mt-1 text-sm text-muted-foreground">Personal job search dashboard</p>
        </div>
        <Button onClick={() => signIn('github', { callbackUrl: '/' })} size="lg">
          Sign in with GitHub
        </Button>
      </div>
    </div>
  );
}
