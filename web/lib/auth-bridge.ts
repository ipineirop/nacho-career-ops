import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { getDb } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

/**
 * TEMPORARY BRIDGE: maps next-auth session email → users.id UUID.
 * Used during the schema migration before we replace next-auth with Supabase Auth.
 * Remove this file once Supabase Auth is in place.
 */
export async function getAuthUserId(): Promise<{ id: string; email: string; name: string } | null> {
  // Dev bypass: no DB locally → return a stable fake user so UI is navigable.
  // Production never trips this: DATABASE_URL is always set there.
  if (
    process.env.NEXT_PUBLIC_DEV_BYPASS === '1' &&
    !process.env.DATABASE_URL &&
    !process.env.SUPABASE_POSTGRES_URL
  ) {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'dev@localhost',
      name: 'Dev User',
    };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const email = session.user.email;
  const db = getDb();

  const rows = await db
    .select({ id: users.id, email: users.email, nameFull: users.nameFull })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (rows.length > 0) {
    return {
      id: rows[0].id,
      email: rows[0].email,
      name: rows[0].nameFull ?? rows[0].email.split('@')[0],
    };
  }

  // Session valid but no DB row — signIn callback failed silently.
  // Self-heal to avoid the /auth/signin ↔ / redirect loop.
  const nameFull = session.user.name || email.split('@')[0];
  const inserted = await db
    .insert(users)
    .values({ email, nameFull })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email, nameFull: users.nameFull });

  if (inserted.length > 0) {
    return {
      id: inserted[0].id,
      email: inserted[0].email,
      name: inserted[0].nameFull ?? email.split('@')[0],
    };
  }

  // Race: another request inserted concurrently. Re-read.
  const reread = await db
    .select({ id: users.id, email: users.email, nameFull: users.nameFull })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (reread.length === 0) return null;
  return {
    id: reread[0].id,
    email: reread[0].email,
    name: reread[0].nameFull ?? email.split('@')[0],
  };
}
