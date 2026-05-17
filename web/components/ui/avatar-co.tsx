import { cn } from '@/lib/utils';

interface AvatarCoProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE = {
  sm: { dim: 32, fontSize: 11, radius: 9 },
  md: { dim: 44, fontSize: 13, radius: 10 },
  lg: { dim: 56, fontSize: 16, radius: 12 },
};

export function AvatarCo({ initials, size = 'md', className }: AvatarCoProps) {
  const { dim, fontSize, radius } = SIZE[size];
  return (
    <div
      className={cn('flex items-center justify-center shrink-0 font-semibold font-ui', className)}
      style={{
        width: dim, height: dim,
        borderRadius: radius,
        background: 'var(--lm-accent-soft)',
        color: 'var(--lm-accent)',
        fontSize,
      }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </div>
  );
}
