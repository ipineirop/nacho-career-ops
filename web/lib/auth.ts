import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { neon } from '@neondatabase/serverless';

function getDb() {
  const url = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
  return neon(url);
}

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
      const key = `${email}:signin_code`;
      try {
        const sql = getDb();
        const rows = await sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`;
        if (!(rows[0] as { value?: string } | undefined)?.value) return null;
        const { code, expiresAt } = JSON.parse((rows[0] as { value: string }).value);
        if (Date.now() > expiresAt) {
          await sql`DELETE FROM settings WHERE key = ${key}`;
          return null;
        }
        if (String(code) !== String(credentials.code).trim()) return null;
        // Consume code
        await sql`DELETE FROM settings WHERE key = ${key}`;
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
