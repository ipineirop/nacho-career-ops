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
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const rows = await getDb()
    .select({ id: users.id, email: users.email, nameFull: users.nameFull })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (rows.length === 0) return null;

  return {
    id: rows[0].id,
    email: rows[0].email,
    name: rows[0].nameFull ?? rows[0].email.split('@')[0],
  };
}
