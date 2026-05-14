import { listDirectory } from '@/lib/github';
import { parseReportFilenames } from '@/lib/parsers';
import { ReportCard } from '@/components/reports/ReportCard';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const files = await listDirectory('reports');
  const reports = parseReportFilenames(files);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reports</h1>
        <span className="text-sm text-muted-foreground">{reports.length} evaluations</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </div>
  );
}
