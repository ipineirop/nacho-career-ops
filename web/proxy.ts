import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const { pathname } = req.nextUrl;
        if (pathname.startsWith('/onboarding')) return true;
        // Local dev bypass: when no DB is configured, let everything through
        // so the UI is navigable without a real session. Production is unaffected
        // because DATABASE_URL is always set there.
        if (
          process.env.NEXT_PUBLIC_DEV_BYPASS === '1' &&
          !process.env.DATABASE_URL &&
          !process.env.SUPABASE_POSTGRES_URL
        ) {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

export const config = {
  matcher: ['/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
