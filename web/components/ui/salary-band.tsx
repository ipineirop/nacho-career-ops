interface SalaryBandProps {
  amount: string;
  label: string;
  flag?: boolean;
  flagText?: string;
  market?: string;
  confidence?: 1 | 2 | 3;
  floor?: string;
  bandStart?: number;  /* 0–100 percentage */
  bandWidth?: number;  /* 0–100 percentage */
  pinAt?: number;      /* 0–100 percentage, only shown when flag=true */
  className?: string;
}

export function SalaryBand({
  amount,
  label,
  flag = false,
  flagText,
  market,
  confidence = 3,
  floor,
  bandStart = 35,
  bandWidth = 35,
  pinAt,
  className,
}: SalaryBandProps) {
  const dots = '●'.repeat(confidence) + '○'.repeat(3 - confidence);
  const confLabel = confidence === 3 ? 'HIGH' : confidence === 2 ? 'MEDIUM' : 'LOW';

  return (
    <div
      className={className}
      style={{
        border: '1px solid var(--lm-line)',
        borderRadius: 10,
        padding: '12px 14px',
        background: 'var(--lm-canvas)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--lm-ink)' }}>
          {amount}
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {label}
        </span>
        {flag && flagText ? (
          <span style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 11px', borderRadius: 999,
            background: 'var(--lm-signal)', color: 'var(--lm-signal-on)',
            fontFamily: 'var(--font-albert-sans)', fontWeight: 500, fontSize: 12,
          }}>
            {flagText}
          </span>
        ) : (
          <span style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 11px', borderRadius: 999,
            background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)',
            fontFamily: 'var(--font-albert-sans)', fontWeight: 500, fontSize: 12,
            border: '1px solid transparent',
          }}>
            in your band
          </span>
        )}
      </div>

      {/* Meter */}
      <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'var(--lm-track)' }}>
        <div style={{
          position: 'absolute', top: 0, height: '100%', borderRadius: 5,
          background: 'var(--lm-accent)', opacity: 0.35,
          left: `${bandStart}%`, width: `${bandWidth}%`,
        }} />
        {flag && pinAt != null && (
          <div style={{
            position: 'absolute', top: -3, width: 2, height: 16,
            background: 'var(--lm-signal)',
            left: `${pinAt}%`,
          }}>
            <div style={{
              position: 'absolute', top: -3, left: -3,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--lm-signal)',
            }} />
          </div>
        )}
      </div>

      {/* Bottom row */}
      <div style={{ display: 'flex', fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {floor && <span>{floor}</span>}
        {market && <span>{market}</span>}
        <span style={{ marginLeft: 'auto' }}>{dots} {confLabel}</span>
      </div>
    </div>
  );
}
