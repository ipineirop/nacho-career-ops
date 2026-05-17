import { getDb, applications } from '@/lib/db';
import { desc } from 'drizzle-orm';
import { OutreachShell } from '@/components/outreach/OutreachShell';

export const dynamic = 'force-dynamic';

export default async function OutreachPage() {
  const db = getDb();
  const apps = await db
    .select({ id: applications.id, company: applications.company, role: applications.role, status: applications.status })
    .from(applications)
    .orderBy(desc(applications.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <OutreachShell applications={apps} />
    </div>
  );
}
