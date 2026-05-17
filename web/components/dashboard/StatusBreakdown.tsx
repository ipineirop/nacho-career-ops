import type { Application } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  Evaluated: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  Applied:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  Responded: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
  Interview: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  Offer:     'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  Rejected:  'bg-red-50 text-red-600 ring-1 ring-red-200',
  Discarded: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
  SKIP:      'bg-gray-50 text-gray-400 ring-1 ring-gray-100',
};

const ALIASES: Record<string, string> = { Evaluada: 'Evaluated' };

export function StatusBreakdown({ applications }: { applications: Application[] }) {
  const counts: Record<string, number> = {};
  for (const app of applications) {
    const status = ALIASES[app.status] ?? app.status;
    counts[status] = (counts[status] ?? 0) + 1;
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([status, count]) => (
        <span
          key={status}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'}`}
        >
          {status}
          <span className="rounded-full bg-current/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">{count}</span>
        </span>
      ))}
    </div>
  );
}
