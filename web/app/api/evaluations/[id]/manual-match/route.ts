import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, evaluations, userEvents } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

export const runtime = 'nodejs';

// §5.2 "this is actually at one of my past employers" — the user tells us the
// role is at a past employer our extraction missed. Set the match record so the
// verdict surfaces it. Score is NOT recomputed (it reflected the role's
// properties, not its history). Logs a high-signal canonical-review event.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserId();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    canonicalId?: string;
    displayName?: string;
    dateRange?: string;
    roleCompanyInput?: string;
  };
  if (!body.displayName) return NextResponse.json({ error: 'displayName required' }, { status: 400 });

  const db = getDb();
  const rows = await db
    .select({ id: evaluations.id, match: evaluations.pastEmployerMatch })
    .from(evaluations)
    .where(and(eq(evaluations.id, id), eq(evaluations.userId, user.id)))
    .limit(1);
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const prev = (rows[0].match ?? {}) as Record<string, unknown>;
  const match = {
    ...prev,
    resolved_canonical_id: body.canonicalId ?? null,
    matches_user_past_employer: true,
    surface: true,
    manual: true,
    matches_via: {
      past_employer_display: body.displayName,
      canonical_id: body.canonicalId ?? null,
      date_range: body.dateRange ?? '',
      relation: 'direct',
    },
  };
  await db.update(evaluations).set({ pastEmployerMatch: match }).where(eq(evaluations.id, id));

  // High-signal: a real user says "company X in this posting = canonical Y".
  await db.insert(userEvents).values({
    userId: user.id,
    eventType: 'manual_match',
    eventData: {
      canonical_id: body.canonicalId ?? null,
      display_name: body.displayName,
      role_company_input: body.roleCompanyInput ?? null,
      evaluation_id: id,
    },
  });

  return NextResponse.json({ ok: true, match });
}
