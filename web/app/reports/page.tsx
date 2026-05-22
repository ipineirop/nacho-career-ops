import { ReportsGrid } from '@/components/reports/ReportsGrid';
import { getDb, evaluations, roles } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/auth-bridge';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  const db = getDb();
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
      const id = String(r.displayId).padStart(3, '0');
      const slug = (r.company ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const date = r.evaluatedAt?.toISOString().split('T')[0] ?? '';
      return { id, slug, date, filename: `${id}-${slug}.md`, path: '' };
    });

  return (
    <div className="p-8 space-y-4 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{reports.length} evaluations</p>
      </div>
      <ReportsGrid reports={reports} />
    </div>
  );
}
