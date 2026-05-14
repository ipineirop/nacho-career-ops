import { NextRequest, NextResponse } from 'next/server';
import { getFile, listDirectory } from '@/lib/github';
import { parseReportFilenames } from '@/lib/parsers';
import { requireAuth } from '@/lib/require-auth';

export async function GET(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    // Return raw markdown content for a specific report
    const files = await listDirectory('reports');
    const reports = parseReportFilenames(files);
    const report = reports.find((r) => r.id === id.padStart(3, '0'));
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }
    const { content } = await getFile(report.path);
    return NextResponse.json({ ...report, content });
  }

  // Return list of all reports
  const files = await listDirectory('reports');
  const reports = parseReportFilenames(files);
  return NextResponse.json(reports);
}
