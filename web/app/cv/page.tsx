import { getDb, applications } from '@/lib/db';
import { desc } from 'drizzle-orm';
import { CVGenerator } from '@/components/cv/CVGenerator';

export const dynamic = 'force-dynamic';

export default async function CVPage() {
  const db = getDb();
  const apps = await db
    .select({
      id: applications.id,
      company: applications.company,
      role: applications.role,
      score: applications.score,
      reportContent: applications.reportContent,
    })
    .from(applications)
    .orderBy(desc(applications.id));

  return (
    <div className="flex h-screen flex-col p-6">
      <CVGenerator applications={apps} />
    </div>
  );
}
