import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { getSql } from '@/lib/db';

function getDb() {
  return getSql();
}

export async function GET(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get('id');
  const sql = getDb();

  if (id) {
    const paddedId = id.padStart(3, '0');
    const rows = await sql`
      SELECT id, date, company, role, score, report_id, report_content
      FROM applications
      WHERE report_id = ${paddedId} OR report_id = ${String(parseInt(paddedId))}
      LIMIT 1
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    const r = rows[0];
    return NextResponse.json({
      id: String(r.report_id).padStart(3, '0'),
      slug: (r.company as string).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      date: r.date,
      filename: `${String(r.report_id).padStart(3, '0')}-${(r.company as string).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${r.date}.md`,
      path: '',
      content: r.report_content ?? '_Report content not available_',
    });
  }

  // List all reports with content
  const rows = await sql`
    SELECT id, date, company, role, score, report_id
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

  return NextResponse.json(reports);
}
