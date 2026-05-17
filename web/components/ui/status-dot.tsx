type Status = 'draft' | 'applied' | 'interview' | 'offer' | 'passed';

const COLOR: Record<Status, string> = {
  draft:     'var(--lm-ink-3)',
  applied:   'var(--lm-signal)',
  interview: 'var(--lm-accent)',
  offer:     'var(--lm-ink)',
  passed:    'var(--lm-ink-2)',
};

export function StatusDot({ status }: { status: Status }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      background: COLOR[status],
      flexShrink: 0,
    }} />
  );
}
