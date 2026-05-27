import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, users, briefCache } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { assembleBrief } from '@/lib/brief/assemble';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/brief?date=YYYY-MM-DD
 *
 * Returns the day's Brief payload (§3 of the handoff). Two response shapes:
 *   - { pending: true, masthead } — only on a user's first view of the day
 *     when no cache exists. The route kicks off generation via after() and
 *     the client polls until the cache lands.
 *   - { pending: false, ... } — full §3 payload. May be a cache hit or a
 *     fresh inline generation (when pendingMode would race the client).
 *
 * Cache-Control is private + max-age until user-local midnight.
 */
export async function GET(req: NextRequest) {
  const authUser = await getAuthUserId();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const explicitDate = url.searchParams.get('date');

  // Compute the user-local ISO date. We trust the user's timezone column,
  // falling back to UTC if missing.
  const db = getDb();
  const [user] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  const timezone = user?.timezone || 'UTC';
  const isoDate = explicitDate || userLocalIsoDate(timezone);

  // Look up the cache directly so we can decide between fast-return,
  // pending-with-background-generation, and inline generation.
  const [cached] = await db
    .select()
    .from(briefCache)
    .where(and(eq(briefCache.userId, authUser.id), eq(briefCache.isoDate, isoDate)))
    .limit(1);

  if (cached) {
    const ttl = secondsUntilUserLocalMidnight(timezone);
    return NextResponse.json(cached.payload, {
      headers: {
        'Cache-Control': `private, max-age=${ttl}`,
      },
    });
  }

  // First view of the day: return pending + background-generate.
  const pendingResponse = await assembleBrief({
    userId: authUser.id,
    isoDate,
    pendingMode: true,
  });

  after(async () => {
    try {
      await assembleBrief({ userId: authUser.id, isoDate, pendingMode: false });
    } catch (err) {
      console.error('brief: background assembly failed', (err as Error)?.message);
    }
  });

  return NextResponse.json(pendingResponse, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** ISO YYYY-MM-DD for the given IANA timezone, today. */
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

/** Seconds remaining until the next midnight in the user's timezone. */
function secondsUntilUserLocalMidnight(timezone: string): number {
  try {
    // Get the current local hour/minute/second in the user's timezone.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    const s = Number(parts.find((p) => p.type === 'second')?.value ?? '0');
    return Math.max(60, 24 * 3600 - (h * 3600 + m * 60 + s));
  } catch {
    return 3600; // safe default — one hour
  }
}
