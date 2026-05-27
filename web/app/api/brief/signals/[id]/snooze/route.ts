import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, signalStates, briefCache, userEvents } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { DEFAULT_SNOOZE_DAYS } from '@/lib/brief/signals/types';

export const runtime = 'nodejs';

/**
 * POST /api/brief/signals/[id]/snooze
 *
 * The route id is the signal's entityRef (which we use as the signal id in
 * the §3 payload). Body optionally carries `{ signalType, durationDays }`.
 * Without signalType we can't write to the (user, type, ref) unique key, so
 * the client must send it.
 *
 * Side effect: invalidates today's brief_cache row so the next GET re-reads
 * signal_states and drops the snoozed occurrence. The LLM bodies are NOT
 * regenerated within a day; we just re-filter signals.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUserId();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: entityRef } = await ctx.params;

  let body: { signalType?: unknown; durationDays?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const signalType = typeof body.signalType === 'string' ? body.signalType : null;
  const durationDays =
    Number.isFinite(Number(body.durationDays)) && Number(body.durationDays) > 0
      ? Math.min(365, Number(body.durationDays))
      : DEFAULT_SNOOZE_DAYS;

  if (!signalType) {
    return NextResponse.json({ error: 'signalType is required' }, { status: 400 });
  }

  const snoozedUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  const db = getDb();

  // Upsert by (userId, signalType, entityRef). The unique index guarantees
  // a single row per occurrence; the second insert hits the conflict path.
  await db
    .insert(signalStates)
    .values({
      userId: authUser.id,
      signalType,
      entityRef,
      snoozedUntil,
    })
    .onConflictDoUpdate({
      target: [signalStates.userId, signalStates.signalType, signalStates.entityRef],
      set: { snoozedUntil, updatedAt: new Date() },
    });

  // Observation log (handoff §6.5).
  await db.insert(userEvents).values({
    userId: authUser.id,
    eventType: 'brief.signal_action',
    eventData: {
      signalId: entityRef,
      signalType,
      action: 'snoozed',
      durationDays,
    },
  });

  // Invalidate cached briefs for this user (there's at most one current
  // row per user thanks to the unique (user_id, iso_date) constraint and
  // the daily TTL). The next GET will drop this occurrence from
  // signals.visible. Easier than surgically rewriting the cached JSON,
  // and acceptable because the LLM bodies for non-snoozed signals will be
  // re-generated as part of the next assemble cycle.
  await db
    .delete(briefCache)
    .where(eq(briefCache.userId, authUser.id));

  return new NextResponse(null, { status: 204 });
}
