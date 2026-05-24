import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, userPreferences } from '@/lib/db';
import { and, eq, isNull } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * POST /api/preferences/coach-mark-dismissed — sticky flag, set once per user.
 * Idempotent: calling twice is a no-op. The teaching-moment coach mark + FAB
 * pulse never appear again after this returns 204.
 */
export async function POST() {
  const authUser = await getAuthUserId();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getDb();
    await db
      .update(userPreferences)
      .set({ coachMarkDismissed: true })
      .where(and(eq(userPreferences.userId, authUser.id), isNull(userPreferences.supersededAt)));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('coach-mark-dismissed failed:', err);
    return NextResponse.json({ error: 'Could not persist dismissal' }, { status: 500 });
  }
}
