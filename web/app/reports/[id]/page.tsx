import { ReportViewer } from '@/components/reports/ReportViewer';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

function getDb() {
  const url = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
  return neon(url);
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paddedId = id.padStart(3, '0');
  const numericId = String(parseInt(id, 10));

  const sql = getDb();
  const rows = await sql`
    SELECT id, date, company, role, score, report_id, report_content
    FROM applications
    WHERE report_id = ${paddedId} OR report_id = ${numericId}
    ORDER BY id ASC
    LIMIT 1
  `;

  if (rows.length === 0) notFound();

  const r = rows[0];
  const content = (r.report_content as string) ?? '_Report content not available. Please re-evaluate this role._';

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/reports" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={14} /> Reports
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{r.company as string}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {r.date as string} · #{paddedId} · {r.score as string}
          </p>
        </div>
      </div>

      <ReportViewer content={content} />
    </div>
  );
}
