import { cn } from '@/lib/utils';

interface AvatarPersonProps {
  initials: string;
  className?: string;
}

export function AvatarPerson({ initials, className }: AvatarPersonProps) {
  return (
    <div
      className={cn('flex items-center justify-center shrink-0 font-semibold font-ui', className)}
      style={{
        width: 36, height: 36,
        borderRadius: 999,
        background: 'var(--lm-signal-soft)',
        color: 'var(--lm-signal)',
        fontSize: 12,
      }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </div>
  );
}
