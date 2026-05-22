import { ReportsGrid } from '@/components/reports/ReportsGrid';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

function getDb() {
  return getSql();
}

export default async function ReportsPage() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, date, company, report_id
    FROM applications
    WHERE report_id IS NOT NULL
    ORDER BY id DESC
  `;

  const reports = rows.map((r) => ({
    id: String(r.report_id).padStart(3, '0'),
    slug: (r.company as string).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    date: r.date as string,
    filename: `${String(r.report_id).padStart(3, '0')}-report.md`,
    path: '',
  }));

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
