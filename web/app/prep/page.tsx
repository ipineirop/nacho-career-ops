export default function PrepPage() {
  return (
    <div style={{ padding: '32px', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
          DOSSIER · COMPANY · ROLE
        </span>
        <span style={{ padding: '4px 14px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500 }}>
          Interview date TBD
        </span>
      </div>

      <h1 className="font-editorial" style={{ fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1, color: 'var(--lm-ink)', margin: 0 }}>
        The <em>dossier</em>.
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['Likely Qs', 'About Co', 'Who you\'ll meet', 'STAR stories', 'Comp prep'].map((t, i) => (
          <span key={t} style={{
            padding: '6px 16px', borderRadius: 999,
            border: '1px solid var(--lm-line)',
            background: i === 0 ? 'var(--lm-ink)' : 'var(--lm-surface)',
            color: i === 0 ? 'var(--lm-bg)' : 'var(--lm-ink-2)',
            fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            {t}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]" style={{ gap: 16 }}>
        {/* Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
            THREE ALMOST-CERTAIN QUESTIONS
          </span>
          {[
            { q: '"Walk me through scaling ops for a multi-country fintech."', prob: '95%', move: 'MX → CO expansion story' },
            { q: '"How do you stay aligned with a US HQ on LatAm-specific risk?"', prob: '90%', move: 'Clip × Mastercard escalation' },
            { q: '"What\'s your bar for hiring a Director-level direct report?"', prob: '70%', move: '+ pick a 3rd story' },
          ].map((item, i) => (
            <div key={i} style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>Q{i + 1}</span>
                <span style={{
                  padding: '3px 10px', borderRadius: 999,
                  background: i < 2 ? 'var(--lm-accent-soft)' : 'var(--lm-signal-soft)',
                  color: i < 2 ? 'var(--lm-accent)' : 'var(--lm-signal)',
                  fontFamily: 'var(--font-albert-sans)', fontSize: 11, fontWeight: 500,
                }}>
                  {item.prob} likely
                </span>
              </div>
              <div className="font-editorial" style={{ fontSize: 19, lineHeight: 1.2, color: 'var(--lm-ink)' }}>
                {item.q}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)' }}>your move →</span>
                <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 12 }}>{item.move}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Side column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
            WHO YOU&apos;LL MEET
          </span>
          {[
            { initials: 'DA', name: 'Diana A.', title: 'VP Ops, LatAm · ex-Stripe' },
            { initials: 'CM', name: 'Carlos M.', title: 'Recruiter · Bogotá' },
          ].map((p) => (
            <div key={p.initials} style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--lm-signal-soft)', color: 'var(--lm-signal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                {p.initials}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, color: 'var(--lm-ink)' }}>{p.name}</div>
                <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-2)' }}>{p.title}</div>
              </div>
            </div>
          ))}

          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase', marginTop: 8 }}>
            COMP PREP
          </span>
          <div style={{ background: 'var(--lm-accent-soft)', border: '1px solid transparent', borderRadius: 10, padding: '14px 16px', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', lineHeight: 1.55 }}>
            Walk in knowing: <strong>$145–185K USD base</strong>. Last 2 LatAm Sr Dir hires came in mid-band. Don&apos;t anchor below $130K.
          </div>
        </div>
      </div>

      {/* Mock chat */}
      <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-accent)', fontWeight: 600 }}>✦ mock with me</span>
          <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)', marginLeft: 'auto' }}>voice or text · 15 min sessions</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '9px 18px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
            Start mock round 1
          </button>
          <button style={{ padding: '9px 18px', borderRadius: 999, border: '1px solid var(--lm-line)', background: 'var(--lm-surface)', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', cursor: 'pointer' }}>
            Quiz me on STAR stories
          </button>
          <button style={{ padding: '9px 18px', borderRadius: 999, border: 'none', background: 'transparent', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)', cursor: 'pointer' }}>
            Print dossier
          </button>
        </div>
      </div>
    </div>
  );
}
