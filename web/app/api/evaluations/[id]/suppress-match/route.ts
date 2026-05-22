import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, evaluations, userPreferences, userEvents } from '@/lib/db';
import { eq, and, isNull } from 'drizzle-orm';

export const runtime = 'nodejs';

// §5.1 "not the same company" — suppress this past-employer match for this user
// so future evaluations don't surface it, and stop surfacing it on this verdict.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserId();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { canonicalId?: string; roleCompanyInput?: string };
  const db = getDb();

  // Load the evaluation (scoped to the user) and turn off surfacing on it.
  const rows = await db
    .select({ id: evaluations.id, match: evaluations.pastEmployerMatch })
    .from(evaluations)
    .where(and(eq(evaluations.id, id), eq(evaluations.userId, user.id)))
    .limit(1);
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const match = (rows[0].match ?? {}) as Record<string, unknown>;
  const canonicalId = body.canonicalId ?? (match.resolved_canonical_id as string | undefined);
  await db
    .update(evaluations)
    .set({ pastEmployerMatch: { ...match, surface: false, suppressed: true } })
    .where(eq(evaluations.id, id));

  // Append the suppression to the user's current preferences (§5.1 shape).
  if (canonicalId) {
    const pref = (
      await db
        .select({ id: userPreferences.id, suppressions: userPreferences.matchSuppressions })
        .from(userPreferences)
        .where(and(eq(userPreferences.userId, user.id), isNull(userPreferences.supersededAt)))
        .limit(1)
    )[0];
    if (pref) {
      const list = Array.isArray(pref.suppressions) ? (pref.suppressions as unknown[]) : [];
      list.push({
        canonical_id: canonicalId,
        role_company_input: body.roleCompanyInput ?? null,
        suppressed_at: new Date().toISOString(),
      });
      await db.update(userPreferences).set({ matchSuppressions: list }).where(eq(userPreferences.id, pref.id));
    }
    // Log for canonical-table review (§4.3 — a real correction signal).
    await db.insert(userEvents).values({
      userId: user.id,
      eventType: 'match_suppressed',
      eventData: { canonical_id: canonicalId, role_company_input: body.roleCompanyInput ?? null, evaluation_id: id },
    });
  }

  return NextResponse.json({ ok: true });
}
