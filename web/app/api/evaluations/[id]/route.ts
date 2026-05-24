import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, evaluations, roles, evaluationGaps, evaluationDimensions, evaluationProofPoints } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/evaluations/[id] — fetch a single evaluation owned by the current
 * user, along with the related role + any structured rows that exist. The
 * /evaluate/[id] page can also fetch server-side; this endpoint exists for
 * the panel and future polling/streaming clients.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUserId();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const db = getDb();

  const [evalRow] = await db
    .select()
    .from(evaluations)
    .where(and(eq(evaluations.id, id), eq(evaluations.userId, authUser.id)))
    .limit(1);

  if (!evalRow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [roleRow] = evalRow.roleId
    ? await db.select().from(roles).where(eq(roles.id, evalRow.roleId)).limit(1)
    : [null];

  const [gaps, dimensions, proofPoints] = await Promise.all([
    db.select().from(evaluationGaps).where(eq(evaluationGaps.evaluationId, evalRow.id)),
    db.select().from(evaluationDimensions).where(eq(evaluationDimensions.evaluationId, evalRow.id)),
    db.select().from(evaluationProofPoints).where(eq(evaluationProofPoints.evaluationId, evalRow.id)),
  ]);

  return NextResponse.json({
    evaluation: evalRow,
    role: roleRow ?? null,
    gaps,
    dimensions,
    proofPoints,
  });
}
