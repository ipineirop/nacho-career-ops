import { Badge } from '@/components/ui/badge';
import type { Application } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  Evaluated: 'bg-blue-100 text-blue-800',
  Evaluada: 'bg-blue-100 text-blue-800',
  Applied: 'bg-green-100 text-green-800',
  Responded: 'bg-yellow-100 text-yellow-800',
  Interview: 'bg-purple-100 text-purple-800',
  Offer: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
  Discarded: 'bg-gray-100 text-gray-600',
  SKIP: 'bg-gray-100 text-gray-400',
};

export function StatusBreakdown({ applications }: { applications: Application[] }) {
  const counts: Record<string, number> = {};
  for (const app of applications) {
    counts[app.status] = (counts[app.status] ?? 0) + 1;
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([status, count]) => (
        <span
          key={status}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}
        >
          {status}
          <span className="font-bold">{count}</span>
        </span>
      ))}
    </div>
  );
}
