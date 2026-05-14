import type { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const allowedEmail = process.env.ALLOWED_EMAIL;
      const allowedLogin = process.env.ALLOWED_GITHUB_LOGIN;
      const githubProfile = profile as { email?: string | null; login?: string };

      if (allowedLogin && githubProfile?.login === allowedLogin) return true;
      if (allowedEmail && githubProfile?.email === allowedEmail) return true;
      return false;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};
