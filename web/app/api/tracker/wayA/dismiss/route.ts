import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { logWayADismissed } from '@/lib/tracker/observation-log';

export const runtime = 'nodejs';

/**
 * POST /api/tracker/wayA/dismiss  { roleId, triggerCode }
 *
 * Records a `tracker.wayA_dismissed` event so the suggestion never re-fires
 * for this `{roleId, triggerCode}` pair across any rendering path (Tracker
 * row, Brief, future Pattern log). The orchestrator in
 * `lib/tracker/wayA/index.ts` consults the suppression set on every render.
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUserId();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { roleId?: unknown; triggerCode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.roleId !== 'string' || typeof body.triggerCode !== 'string') {
    return NextResponse.json(
      { error: '`roleId` (string) and `triggerCode` (string) are required' },
      { status: 400 },
    );
  }

  await logWayADismissed({
    userId: authUser.id,
    roleId: body.roleId,
    triggerCode: body.triggerCode,
  });

  return new NextResponse(null, { status: 204 });
}
