export function scoreColor(score: number): string {
  if (score >= 4) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 3) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

export function scoreBg(score: number): string {
  if (score >= 4) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (score >= 3) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  return 'bg-red-50 text-red-700 ring-1 ring-red-200';
}
