import { getDb, evaluations, roles } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { CVGenerator } from '@/components/cv/CVGenerator';

export const dynamic = 'force-dynamic';

export default async function CVPage() {
  const db = getDb();
  const evals = await db
    .select()
    .from(evaluations)
    .orderBy(desc(evaluations.id));

  // Enrich with role data
  const apps = await Promise.all(
    evals.map(async (e) => {
      const roleData = await db
        .select()
        .from(roles)
        .where(eq(roles.id, e.roleId!))
        .limit(1);

      return {
        id: e.id,
        company: roleData[0]?.companyName ?? 'Unknown',
        role: roleData[0]?.roleTitle ?? 'Unknown',
        score: e.displayId,
        reportContent: e.fullReportMarkdown,
      };
    })
  );

  return (
    <div className="flex h-screen flex-col p-6">
      <CVGenerator applications={apps} />
    </div>
  );
}
