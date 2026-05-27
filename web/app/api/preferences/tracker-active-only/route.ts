import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, userPreferences } from '@/lib/db';
import { and, eq, isNull } from 'drizzle-orm';
import { logActiveOnlyToggled } from '@/lib/tracker/observation-log';

export const runtime = 'nodejs';

/**
 * POST /api/preferences/tracker-active-only  { active: boolean }
 *
 * Persists the Tracker's active-only toggle state per user so it syncs
 * across devices (the wiring doc explicitly rules out localStorage). The
 * column is `user_preferences.tracker_active_only`, added by migration
 * 0014. Toggle changes are also logged to userEvents as
 * `tracker.activeOnly_toggled` for telemetry — separate channel from the
 * row-action observation log.
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUserId();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { active?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: '`active` must be a boolean' }, { status: 400 });
  }

  try {
    const db = getDb();
    await db
      .update(userPreferences)
      .set({ trackerActiveOnly: body.active })
      .where(and(eq(userPreferences.userId, authUser.id), isNull(userPreferences.supersededAt)));
    // Telemetry channel — best-effort.
    await logActiveOnlyToggled(authUser.id, body.active);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('tracker-active-only failed:', err);
    return NextResponse.json({ error: 'Could not persist toggle' }, { status: 500 });
  }
}
