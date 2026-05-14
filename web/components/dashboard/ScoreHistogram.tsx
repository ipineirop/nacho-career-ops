import type { Application } from '@/lib/types';

const BUCKETS = [
  { label: '1–2', min: 1, max: 2 },
  { label: '2–3', min: 2, max: 3 },
  { label: '3–4', min: 3, max: 4 },
  { label: '4–5', min: 4, max: 5.1 },
];

export function ScoreHistogram({ applications }: { applications: Application[] }) {
  const counts = BUCKETS.map(({ min, max }) => ({
    ...{ min, max },
    label: min === 4 ? '4–5 ★' : `${min}–${max}`,
    count: applications.filter((a) => a.scoreNum >= min && a.scoreNum < max).length,
  }));

  const max = Math.max(...counts.map((b) => b.count), 1);

  return (
    <div className="flex items-end gap-3 h-20">
      {counts.map((bucket) => (
        <div key={bucket.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-medium text-muted-foreground">{bucket.count}</span>
          <div
            className={`w-full rounded-t ${bucket.min >= 4 ? 'bg-green-500' : bucket.min >= 3 ? 'bg-blue-400' : 'bg-gray-300'}`}
            style={{ height: `${(bucket.count / max) * 56 + 4}px` }}
          />
          <span className="text-xs text-muted-foreground">{bucket.label}</span>
        </div>
      ))}
    </div>
  );
}
