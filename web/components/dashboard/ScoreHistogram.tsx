import type { Application } from '@/lib/types';

const BUCKETS = [
  { label: '1–2', min: 1, max: 2, bar: 'bg-red-400', text: 'text-red-600' },
  { label: '2–3', min: 2, max: 3, bar: 'bg-amber-400', text: 'text-amber-600' },
  { label: '3–4', min: 3, max: 4, bar: 'bg-blue-400', text: 'text-blue-600' },
  { label: '4–5', min: 4, max: 5.1, bar: 'bg-emerald-500', text: 'text-emerald-600' },
];

export function ScoreHistogram({ applications }: { applications: Application[] }) {
  const counts = BUCKETS.map((b) => ({
    ...b,
    count: applications.filter((a) => a.scoreNum >= b.min && a.scoreNum < b.max).length,
  }));

  const max = Math.max(...counts.map((b) => b.count), 1);

  return (
    <div className="flex items-end gap-4 h-24 pt-2">
      {counts.map((bucket) => (
        <div key={bucket.label} className="flex flex-1 flex-col items-center gap-2">
          <span className={`text-xs font-semibold tabular-nums ${bucket.text}`}>{bucket.count}</span>
          <div className="w-full flex items-end" style={{ height: '56px' }}>
            <div
              className={`w-full rounded-full transition-all duration-500 ${bucket.bar} opacity-90`}
              style={{ height: `${Math.max((bucket.count / max) * 56, bucket.count > 0 ? 6 : 2)}px` }}
            />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">{bucket.label}</span>
        </div>
      ))}
    </div>
  );
}
