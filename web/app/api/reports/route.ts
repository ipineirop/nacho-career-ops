import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, evaluations, roles } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUserId();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const id = req.nextUrl.searchParams.get('id');

  if (id) {
    const paddedId = id.padStart(3, '0');
    const rows = await db
      .select({
        displayId: evaluations.displayId,
        evaluatedAt: evaluations.evaluatedAt,
        company: roles.companyName,
        role: roles.roleTitle,
        score: evaluations.overallScore,
        content: evaluations.fullReportMarkdown,
      })
      .from(evaluations)
      .innerJoin(roles, eq(roles.id, evaluations.roleId))
      .where(and(eq(evaluations.displayId, paddedId), eq(evaluations.userId, authUser.id)))
      .limit(1);

    if (rows.length === 0) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    const r = rows[0];
    const slug = (r.company ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const date = r.evaluatedAt?.toISOString().split('T')[0] ?? '';
    return NextResponse.json({
      id: paddedId,
      slug,
      date,
      filename: `${paddedId}-${slug}-${date}.md`,
      path: '',
      content: r.content ?? '_Report content not available_',
    });
  }

  const rows = await db
    .select({
      displayId: evaluations.displayId,
      evaluatedAt: evaluations.evaluatedAt,
      company: roles.companyName,
    })
    .from(evaluations)
    .innerJoin(roles, eq(roles.id, evaluations.roleId))
    .where(eq(evaluations.userId, authUser.id))
    .orderBy(desc(evaluations.evaluatedAt));

  const reports = rows
    .filter((r) => r.displayId)
    .map((r) => {
      const id2 = String(r.displayId).padStart(3, '0');
      const slug = (r.company ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return { id: id2, slug, date: r.evaluatedAt?.toISOString().split('T')[0] ?? '', filename: `${id2}-report.md`, path: '' };
    });

  return NextResponse.json(reports);
}
