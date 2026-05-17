import Link from 'next/link';
import type { Report } from '@/lib/types';

function formatSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ReportCard({ report }: { report: Report }) {
  return (
    <Link
      href={`/reports/${report.id}`}
      className="group block rounded-xl border border-border/40 bg-card p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
          #{report.id}
        </span>
        <span className="text-[10px] text-muted-foreground">{report.date}</span>
      </div>
      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
        {formatSlug(report.slug)}
      </p>
    </Link>
  );
}
