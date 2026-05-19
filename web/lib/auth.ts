import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getDb, users, signinCodes } from './db';
import { eq } from 'drizzle-orm';

const providers = [];

// LinkedIn OAuth
if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
  providers.push({
    id: 'linkedin',
    name: 'LinkedIn',
    type: 'oauth' as const,
    authorization: {
      url: 'https://www.linkedin.com/oauth/v2/authorization',
      params: { scope: 'openid profile email' },
    },
    token: 'https://www.linkedin.com/oauth/v2/accessToken',
    userinfo: 'https://api.linkedin.com/v2/userinfo',
    issuer: 'https://www.linkedin.com/oauth',
    jwks_endpoint: 'https://www.linkedin.com/oauth/openid/jwks',
    checks: ['state'] as ['state'],
    client: { token_endpoint_auth_method: 'client_secret_post' as const },
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    profile(profile: { sub: string; name: string; email: string; picture?: string }) {
      return { id: profile.sub, name: profile.name, email: profile.email, image: profile.picture ?? null };
    },
  });
}

// Email OTP — any email can sign in if they verify with a code
providers.push(
  CredentialsProvider({
    id: 'email-otp',
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      code: { label: 'Code', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.code) return null;
      const email = credentials.email.toLowerCase().trim();
      try {
        const db = getDb();

        // Find the signin code
        const rows = await db
          .select()
          .from(signinCodes)
          .where(eq(signinCodes.email, email))
          .limit(1);

        if (!rows.length) return null;

        const record = rows[0];
        if (Date.now() > record.expiresAt.getTime()) {
          // Code expired, delete it
          await db.delete(signinCodes).where(eq(signinCodes.email, email));
          return null;
        }

        if (String(record.code) !== String(credentials.code).trim()) return null;

        // Code matches, delete it (consume the code)
        await db.delete(signinCodes).where(eq(signinCodes.email, email));

        return { id: email, email, name: email.split('@')[0] };
      } catch { return null; }
    },
  })
);

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account }) {
      if (!user?.email) return false;

      try {
        const db = getDb();

        // Check if user exists
        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        // If user doesn't exist, create them
        if (existing.length === 0) {
          await db
            .insert(users)
            .values({
              email: user.email,
              nameFull: user.name || user.email.split('@')[0],
            });
        }
      } catch (err) {
        console.error('Error in signIn callback:', err);
        // Continue anyway - user can sign in even if DB write fails
      }

      // LinkedIn: allow any user with email
      if (account?.provider === 'linkedin') return !!(user?.email || user?.name);
      // Email OTP: authorize() already validated — if we got here, it's valid
      if (account?.provider === 'email-otp') return true;
      return false;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      // Ensure email from LinkedIn sub is preserved
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
  },
  pages: { signIn: '/auth/signin' },
};
