import { redirect } from 'next/navigation';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, users, briefCache } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { BriefView } from './BriefView';
import type { BriefApiResponse } from '@/lib/brief/types';

export const dynamic = 'force-dynamic';

/**
 * /brief — Labra's daily editorial surface.
 *
 * The server reads the current user, computes the user-local ISO date, and
 * checks brief_cache directly. On a cache hit we hand the resolved payload
 * straight to the client component (no API round-trip). On a cache miss we
 * hand a `pending` payload — the client renders the skeleton and polls
 * /api/brief, which kicks off background generation via after().
 *
 * Locale: we read `users.locale` here and pass it as the initial locale to
 * the client. With no global nav toggle in v1, the locale is effectively
 * read-only on this surface (changing it requires /settings + reload).
 */
export default async function BriefPage() {
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  const db = getDb();
  const [user] = await db
    .select({ locale: users.locale, timezone: users.timezone, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  const locale: 'en' | 'es' = (user?.locale ?? '').startsWith('en') ? 'en' : 'es';
  const isoDate = userLocalIsoDate(user?.timezone || 'UTC');

  // Cache hit: hand the resolved §3 payload directly. The route at
  // /api/brief covers the cache-miss path (background generation + polling),
  // so the server here just optimizes the common case.
  const [cached] = await db
    .select()
    .from(briefCache)
    .where(and(eq(briefCache.userId, authUser.id), eq(briefCache.isoDate, isoDate)))
    .limit(1);

  const initialPayload: BriefApiResponse | null = cached
    ? (cached.payload as BriefApiResponse)
    : null;

  return (
    <BriefView
      initialPayload={initialPayload}
      initialLocale={locale}
      isoDate={isoDate}
    />
  );
}

/** ISO YYYY-MM-DD for the given IANA timezone, today. Duplicates the helper
 *  in app/api/brief/route.ts — small enough to inline here so the page doesn't
 *  need to call the API just to learn what "today" is. */
function userLocalIsoDate(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
