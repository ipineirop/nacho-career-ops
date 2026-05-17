'use client';

import { useState } from 'react';
import type { Report } from '@/lib/types';
import { ReportCard } from './ReportCard';

export function ReportsGrid({ reports }: { reports: Report[] }) {
  const [query, setQuery] = useState('');

  const filtered = query
    ? reports.filter(
        (r) =>
          r.slug.toLowerCase().includes(query.toLowerCase()) ||
          r.id.includes(query) ||
          r.date.includes(query),
      )
    : reports;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search company, date, or report #…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-64 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-sm text-muted-foreground">{filtered.length} reports</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No reports match "{query}"</p>
      )}
    </div>
  );
}
