import { getDb, evaluations, roles, pipelineStatus } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/auth-bridge';
import { redirect } from 'next/navigation';
import { TrackerShell } from '@/components/tracker/TrackerShell';

export const dynamic = 'force-dynamic';

export default async function TrackerPage() {
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  const db = getDb();
  const rows = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.userId, authUser.id));

  // Enrich with role and pipeline data
  const apps = await Promise.all(
    rows.map(async (r) => {
      const roleData = await db
        .select()
        .from(roles)
        .where(eq(roles.id, r.roleId))
        .limit(1);

      const pipelineData = await db
        .select()
        .from(pipelineStatus)
        .where(and(eq(pipelineStatus.userId, authUser.id), eq(pipelineStatus.roleId, r.roleId)))
        .limit(1);

      return {
        id: r.id,
        date: r.evaluatedAt?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
        company: roleData[0]?.companyName ?? 'Unknown',
        role: roleData[0]?.roleTitle ?? 'Unknown',
        score: r.displayId ?? '',
        scoreNum: r.overallScore ? Number(r.overallScore) / 20 : 0,
        status: pipelineData[0]?.status ?? 'evaluating',
        hasPdf: !!r.fullReportMarkdown,
        reportId: r.displayId ?? null,
        notes: pipelineData[0]?.notesMarkdown ?? '',
      };
    })
  );

  return <TrackerShell apps={apps} />;
}
