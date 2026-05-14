import Link from 'next/link';
import type { Report } from '@/lib/types';

export function ReportCard({ report }: { report: Report }) {
  const company = report.slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <Link
      href={`/reports/${report.id}`}
      className="block rounded-lg border bg-card p-4 hover:border-primary/50 hover:bg-accent/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{company}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{report.date}</p>
        </div>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
          #{report.id}
        </span>
      </div>
    </Link>
  );
}
