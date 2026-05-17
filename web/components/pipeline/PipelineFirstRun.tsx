'use client';

import { useEffect, useState } from 'react';

type State = 'scanning' | 'done' | 'error' | 'idle';

export function PipelineFirstRun() {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<{ inserted?: number; matched?: number; scanned?: number } | null>(null);

  useEffect(() => {
    // Auto-trigger scan on mount
    setState('scanning');
    fetch('/api/scan', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        setResult(data);
        setState('done');
        // Auto-reload page after 2s to show new jobs
        if ((data.inserted ?? 0) > 0) {
          setTimeout(() => window.location.reload(), 2000);
        }
      })
      .catch(() => setState('error'));
  }, []);

  if (state === 'scanning') {
    return (
      <div style={{ background: 'var(--lm-accent-soft)', border: '1px solid var(--lm-accent)', borderRadius: 10, padding: '48px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 24, color: 'var(--lm-accent)', animation: 'spin 2s linear infinite' }}>⟳</div>
        <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 17, color: 'var(--lm-ink)' }}>
          Scanning your target companies…
        </div>
        <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-ink-2)', margin: 0, maxWidth: 380 }}>
          Hitting Greenhouse, Ashby, and Lever APIs for your target companies. This takes about 15–30 seconds.
        </p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state === 'done' && result) {
    if ((result.inserted ?? 0) === 0) {
      return (
        <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '48px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 17, color: 'var(--lm-ink)' }}>
            Scan complete — {result.scanned} companies checked
          </div>
          <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-ink-2)', margin: 0, maxWidth: 420 }}>
            No new openings matching your keywords right now. {result.matched === 0 ? 'Try broadening your search keywords in Settings.' : `Found ${result.matched} matches but they're already in your pipeline.`}
          </p>
          <button onClick={() => { setState('scanning'); fetch('/api/scan', { method: 'POST' }).then(r => r.json()).then(d => { setResult(d); setState('done'); if ((d.inserted ?? 0) > 0) setTimeout(() => window.location.reload(), 1500); }).catch(() => setState('error')); }}
            style={{ padding: '8px 20px', borderRadius: 999, background: 'var(--lm-ink)', color: 'var(--lm-bg)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Scan again ↻
          </button>
        </div>
      );
    }
    // Inserted > 0 — will auto-reload, show success flash
    return (
      <div style={{ background: 'var(--lm-accent-soft)', border: '1px solid var(--lm-accent)', borderRadius: 10, padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 17, color: 'var(--lm-ink)' }}>
          ✓ Found {result.inserted} new lead{result.inserted !== 1 ? 's' : ''}
        </div>
        <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-ink-2)', margin: 0 }}>Loading your brief…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{ background: 'var(--lm-signal-soft)', border: '1px solid var(--lm-signal)', borderRadius: 10, padding: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 16, color: 'var(--lm-signal)' }}>Scan failed</div>
        <button onClick={() => { setState('scanning'); fetch('/api/scan', { method: 'POST' }).then(r => r.json()).then(d => { setResult(d); setState('done'); }).catch(() => setState('error')); }}
          style={{ padding: '7px 18px', borderRadius: 999, background: 'var(--lm-signal)', color: 'white', border: 'none', fontFamily: 'var(--font-albert-sans)', fontSize: 13, cursor: 'pointer' }}>
          Retry ↻
        </button>
      </div>
    );
  }

  return null;
}
