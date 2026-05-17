import { getDb, applications } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { TrackerShell } from '@/components/tracker/TrackerShell';

export const dynamic = 'force-dynamic';

export default async function TrackerPage() {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email ?? '';
  const rows = await getDb().select().from(applications).where(eq(applications.userEmail, userEmail)).orderBy(applications.id);

  const apps = rows.map((r) => ({
    id: r.id, date: r.date, company: r.company, role: r.role,
    score: r.score ?? '', scoreNum: r.scoreNum ?? 0,
    status: r.status ?? 'Evaluated', hasPdf: r.hasPdf ?? false,
    reportId: r.reportId ?? null, notes: r.notes ?? '',
  }));

  return <TrackerShell apps={apps} />;
}
