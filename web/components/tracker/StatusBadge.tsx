const STATUS_CONFIG: Record<string, { bg: string; dot: string; text: string }> = {
  Evaluated: { bg: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200', dot: 'bg-blue-500', text: 'Evaluated' },
  Evaluada:  { bg: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200', dot: 'bg-blue-500', text: 'Evaluated' },
  Applied:   { bg: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500', text: 'Applied' },
  Responded: { bg: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200', dot: 'bg-yellow-500', text: 'Responded' },
  Interview: { bg: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200', dot: 'bg-purple-500', text: 'Interview' },
  Offer:     { bg: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200', dot: 'bg-teal-500', text: 'Offer' },
  Rejected:  { bg: 'bg-red-50 text-red-600 ring-1 ring-red-200', dot: 'bg-red-400', text: 'Rejected' },
  Discarded: { bg: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200', dot: 'bg-gray-400', text: 'Discarded' },
  SKIP:      { bg: 'bg-gray-50 text-gray-400 ring-1 ring-gray-100', dot: 'bg-gray-300', text: 'SKIP' },
};

const FALLBACK = { bg: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200', dot: 'bg-gray-400', text: '' };

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { ...FALLBACK, text: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${cfg.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.text || status}
    </span>
  );
}
