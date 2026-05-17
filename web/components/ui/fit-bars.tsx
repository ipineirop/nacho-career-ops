interface FitDim {
  label: string;
  grade: string;
  pct: number;
}

interface FitBarsProps {
  dims: FitDim[];
}

function gradeToVariant(grade: string): 'strong' | 'soft' | 'signal' {
  if (grade.startsWith('A')) return 'strong';
  if (grade.startsWith('B') || grade.startsWith('C')) return 'soft';
  return 'signal';
}

export function FitBars({ dims }: FitBarsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {dims.map((d) => {
        const variant = gradeToVariant(d.grade);
        const fillColor = variant === 'strong'
          ? 'var(--lm-accent)'
          : variant === 'soft'
          ? 'var(--lm-accent)'
          : 'var(--lm-signal)';
        const opacity = variant === 'soft' ? 0.55 : 1;

        return (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 70, flexShrink: 0,
              fontFamily: 'var(--font-geist-mono)', fontSize: 10.5,
              color: 'var(--lm-ink-3)', letterSpacing: '0.5px', textTransform: 'uppercase',
            }}>
              {d.label}
            </span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--lm-track)', position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${d.pct}%`,
                background: fillColor,
                borderRadius: 3,
                opacity,
              }} />
            </div>
            <span style={{
              width: 22, textAlign: 'right',
              fontFamily: 'var(--font-geist-mono)', fontSize: 11,
              color: 'var(--lm-ink)',
            }}>
              {d.grade}
            </span>
          </div>
        );
      })}
    </div>
  );
}
