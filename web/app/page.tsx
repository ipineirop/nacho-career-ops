import { getFile } from '@/lib/github';
import { parseApplications, parsePipeline } from '@/lib/parsers';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { StatusBreakdown } from '@/components/dashboard/StatusBreakdown';
import { ScoreHistogram } from '@/components/dashboard/ScoreHistogram';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [{ content: appsMd }, { content: pipelineMd }] = await Promise.all([
    getFile('data/applications.md'),
    getFile('data/pipeline.md'),
  ]);

  const applications = parseApplications(appsMd);
  const pipeline = parsePipeline(pipelineMd);

  const pendingPipeline = pipeline.filter((j) => !j.checked);
  const withPdf = applications.filter((a) => a.hasPdf).length;
  const avgScore =
    applications.length > 0
      ? (applications.reduce((s, a) => s + a.scoreNum, 0) / applications.length).toFixed(1)
      : '—';

  const recent = [...applications].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard title="Total evaluated" value={applications.length} />
        <StatsCard title="PDFs generated" value={withPdf} />
        <StatsCard title="Avg score" value={avgScore} sub="out of 5" />
        <StatsCard title="Pipeline backlog" value={pendingPipeline.length} sub="pending evaluation" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">By status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdown applications={applications} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Score distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreHistogram applications={applications} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent evaluations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {recent.map((app) => (
              <div key={app.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{app.company}</p>
                  <p className="truncate text-xs text-muted-foreground">{app.role}</p>
                </div>
                <div className="ml-4 flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold">{app.score}</span>
                  {app.reportId && (
                    <Link
                      href={`/reports/${app.reportId}`}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Report
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
