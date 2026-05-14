import { getFile, listDirectory } from '@/lib/github';
import { parseReportFilenames } from '@/lib/parsers';
import { ReportViewer } from '@/components/reports/ReportViewer';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paddedId = id.padStart(3, '0');

  const files = await listDirectory('reports');
  const reports = parseReportFilenames(files);
  const report = reports.find((r) => r.id === paddedId);

  if (!report) notFound();

  const { content } = await getFile(report.path);

  const company = report.slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <div className="p-6 max-w-4xl">
      <Link
        href="/reports"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={14} /> Reports
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{company}</h1>
          <p className="text-sm text-muted-foreground">{report.date} · #{report.id}</p>
        </div>
      </div>

      <ReportViewer content={content} />
    </div>
  );
}
