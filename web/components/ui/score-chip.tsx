import { cn } from '@/lib/utils';

interface ScoreChipProps {
  score: number;
  size?: 'sm' | 'md';
  variant?: 'default' | 'flag' | 'muted';
  className?: string;
}

export function ScoreChip({ score, size = 'md', variant = 'default', className }: ScoreChipProps) {
  const dim = size === 'md' ? 56 : 44;
  const fontSize = size === 'md' ? 20 : 16;

  const bg = variant === 'flag'
    ? 'var(--lm-signal)'
    : variant === 'muted'
    ? 'var(--lm-canvas)'
    : 'var(--lm-accent)';

  const color = variant === 'flag'
    ? 'var(--lm-signal-on)'
    : variant === 'muted'
    ? 'var(--lm-ink-2)'
    : 'var(--lm-accent-on)';

  return (
    <div
      className={cn('flex items-center justify-center shrink-0 font-ui font-bold', className)}
      style={{
        width: dim,
        height: dim,
        borderRadius: 10,
        background: bg,
        color,
        fontSize,
        fontFamily: 'var(--font-albert-sans)',
        lineHeight: 1,
      }}
    >
      {score}
    </div>
  );
}
