import { getDb, evaluations, roles, pipelineStatus } from '@/lib/db';
import { desc, eq, and } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/auth-bridge';
import { redirect } from 'next/navigation';
import { OutreachShell } from '@/components/outreach/OutreachShell';

export const dynamic = 'force-dynamic';

export default async function OutreachPage() {
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  const db = getDb();
  const evals = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.userId, authUser.id))
    .orderBy(desc(evaluations.id));

  // Enrich with role and pipeline data
  const apps = await Promise.all(
    evals.map(async (e) => {
      const roleData = await db
        .select()
        .from(roles)
        .where(eq(roles.id, e.roleId!))
        .limit(1);

      const pipelineData = await db
        .select()
        .from(pipelineStatus)
        .where(and(eq(pipelineStatus.userId, authUser.id), eq(pipelineStatus.roleId, e.roleId!)))
        .limit(1);

      return {
        id: e.id,
        company: roleData[0]?.companyName ?? 'Unknown',
        role: roleData[0]?.roleTitle ?? 'Unknown',
        status: pipelineData[0]?.status ?? 'evaluating',
      };
    })
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <OutreachShell applications={apps} />
    </div>
  );
}
