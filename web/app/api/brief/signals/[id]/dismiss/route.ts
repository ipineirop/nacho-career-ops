import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, signalStates, briefCache, userEvents } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * POST /api/brief/signals/[id]/dismiss
 *
 * Per handoff §6.2: dismissing a signal sets dismissedAt on its
 * (user, type, entityRef) row, suppressing that occurrence permanently.
 * A new trigger of the same type with a different entity_ref can still
 * resurface a fresh signal later.
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

  let body: { signalType?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const signalType = typeof body.signalType === 'string' ? body.signalType : null;
  if (!signalType) {
    return NextResponse.json({ error: 'signalType is required' }, { status: 400 });
  }

  const dismissedAt = new Date();
  const db = getDb();

  await db
    .insert(signalStates)
    .values({
      userId: authUser.id,
      signalType,
      entityRef,
      dismissedAt,
    })
    .onConflictDoUpdate({
      target: [signalStates.userId, signalStates.signalType, signalStates.entityRef],
      set: { dismissedAt, updatedAt: new Date() },
    });

  await db.insert(userEvents).values({
    userId: authUser.id,
    eventType: 'brief.signal_action',
    eventData: {
      signalId: entityRef,
      signalType,
      action: 'dismissed',
    },
  });

  await db.delete(briefCache).where(eq(briefCache.userId, authUser.id));

  return new NextResponse(null, { status: 204 });
}
