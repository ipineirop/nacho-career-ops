const STATUS_STYLES: Record<string, string> = {
  Evaluated: 'bg-blue-100 text-blue-800',
  Evaluada: 'bg-blue-100 text-blue-800',
  Applied: 'bg-green-100 text-green-800',
  Responded: 'bg-yellow-100 text-yellow-800',
  Interview: 'bg-purple-100 text-purple-800',
  Offer: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
  Discarded: 'bg-gray-100 text-gray-500',
  SKIP: 'bg-gray-100 text-gray-400',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{status}</span>
  );
}
