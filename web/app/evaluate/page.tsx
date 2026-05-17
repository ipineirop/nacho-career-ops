'use client';

import { useState } from 'react';
import { StreamingOutput } from '@/components/ai/StreamingOutput';
import { FitBars } from '@/components/ui/fit-bars';
import { SalaryBand } from '@/components/ui/salary-band';
import { ScoreChip } from '@/components/ui/score-chip';

type InputMode = 'dm' | 'url' | 'jd';

export default function EvaluatePage() {
  const [inputMode, setInputMode] = useState<InputMode>('dm');
  const [jd, setJd] = useState('');
  const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRun() {
    if (!jd.trim() || loading) return;
    setLoading(true);
    setDone(false);
    setStream(null);
    try {
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (!res.body) throw new Error('No stream');
      setStream(res.body);
    } catch (err) {
      console.error(err);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setJd('');
    setStream(null);
    setDone(false);
  }

  const INPUT_LABELS: Record<InputMode, string> = {
    dm: 'Recruiter DM',
    url: 'Job URL',
    jd: 'Paste JD',
  };

  const PLACEHOLDERS: Record<InputMode, string> = {
    dm: 'Paste a recruiter message — "Hi Nacho! We just opened a Head of Ops seat…"',
    url: 'https://careers.company.com/jobs/director-operations',
    jd: 'Paste the full job description here…',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1280, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 32,
            color: 'var(--lm-ink)', margin: 0, letterSpacing: '-0.8px',
          }}>
            Got a lead? Paste it.
          </h1>
          <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14.5, color: 'var(--lm-ink-2)', marginTop: 6 }}>
            URL, job description, or a recruiter&apos;s message.{' '}
            <span style={{ color: 'var(--lm-accent)', fontWeight: 500 }}>In about a minute</span> you&apos;ll know.
          </p>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 4 }}>
          {(['dm', 'url', 'jd'] as InputMode[]).map((m) => (
            <button key={m} onClick={() => setInputMode(m)} style={{
              padding: '5px 14px', borderRadius: 999,
              border: '1px solid var(--lm-line)',
              background: inputMode === m ? 'var(--lm-ink)' : 'var(--lm-surface)',
              color: inputMode === m ? 'var(--lm-bg)' : 'var(--lm-ink-2)',
              fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
            }}>
              {INPUT_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      {!stream && (
        <div style={{
          border: '1px dashed var(--lm-line)',
          borderRadius: 10, padding: '16px 18px',
          background: 'var(--lm-canvas)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder={PLACEHOLDERS[inputMode]}
            rows={8}
            style={{
              width: '100%', border: 'none', background: 'transparent',
              fontFamily: 'var(--font-albert-sans)', fontSize: 14.5, lineHeight: 1.55,
              color: 'var(--lm-ink)', resize: 'none', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8, borderTop: '1px dashed var(--lm-line)' }}>
            <button
              onClick={handleRun}
              disabled={!jd.trim() || loading}
              style={{
                padding: '9px 20px', borderRadius: 999,
                background: (!jd.trim() || loading) ? 'var(--lm-canvas)' : 'var(--lm-accent)',
                color: (!jd.trim() || loading) ? 'var(--lm-ink-3)' : 'var(--lm-accent-on)',
                border: 'none',
                fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 13,
                cursor: (!jd.trim() || loading) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Evaluating…' : 'Evaluate →'}
            </button>
            {jd && (
              <button onClick={handleClear} style={{
                padding: '9px 16px', borderRadius: 999,
                background: 'transparent', border: 'none',
                fontFamily: 'var(--font-albert-sans)', fontSize: 13,
                color: 'var(--lm-ink-3)', cursor: 'pointer',
              }}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Streaming output */}
      {stream && (
        <div style={{
          background: 'var(--lm-surface)',
          border: '1px solid var(--lm-line)',
          borderRadius: 10, padding: '24px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: 10.5,
            color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            EVALUATION IN PROGRESS
          </div>
          <StreamingOutput stream={stream} onComplete={() => setDone(true)} />
          {done && (
            <div style={{ display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid var(--lm-line)' }}>
              <a
                href="/tracker"
                style={{
                  padding: '9px 16px', borderRadius: 999,
                  background: 'var(--lm-accent)', color: 'var(--lm-accent-on)',
                  fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 13,
                  textDecoration: 'none',
                }}
              >
                Save to Tracker
              </a>
              <button onClick={handleClear} style={{
                padding: '9px 16px', borderRadius: 999,
                border: '1px solid var(--lm-line)', background: 'var(--lm-surface)',
                fontFamily: 'var(--font-albert-sans)', fontSize: 13,
                color: 'var(--lm-ink)', cursor: 'pointer',
              }}>
                New evaluation
              </button>
              <button onClick={handleClear} style={{
                padding: '9px 16px', borderRadius: 999,
                border: 'none', background: 'transparent',
                fontFamily: 'var(--font-albert-sans)', fontSize: 13,
                color: 'var(--lm-ink-3)', cursor: 'pointer',
              }}>
                Discard
              </button>
              <span style={{
                marginLeft: 'auto',
                fontFamily: 'var(--font-geist-mono)', fontSize: 11,
                color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px',
                alignSelf: 'center',
              }}>
                EVALUATION COMPLETE
              </span>
            </div>
          )}
        </div>
      )}

      {/* Design system demo — verdict layout shown when no active eval */}
      {!stream && !jd && (
        <EvaluateDemo />
      )}
    </div>
  );
}

function EvaluateDemo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        fontFamily: 'var(--font-geist-mono)', fontSize: 10.5,
        color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase',
      }}>
        EXAMPLE VERDICT
      </div>

      {/* Verdict strip */}
      <div style={{
        background: 'var(--lm-surface)', border: '2px solid var(--lm-line)',
        borderRadius: 10, padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <ScoreChip score={82} size="md" variant="flag" />
        <div style={{ flex: 1 }}>
          <div className="font-editorial" style={{ fontSize: 28, color: 'var(--lm-ink)', lineHeight: 1.05 }}>
            Worth your time — <em>with caveats</em>.
          </div>
          <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)', marginTop: 4 }}>
            Stori · Head of Operations · CDMX · Hybrid · Fintech / lending
          </div>
        </div>
        <span style={{
          padding: '5px 14px', borderRadius: 999,
          background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)',
          fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500,
        }}>
          strong fit
        </span>
      </div>

      {/* 4-pane grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {/* Fit */}
        <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
            FIT · A–F ACROSS 10 DIMS
          </div>
          <FitBars dims={[
            { label: 'scope',    grade: 'A',  pct: 88 },
            { label: 'domain',   grade: 'A',  pct: 90 },
            { label: 'level',    grade: 'C+', pct: 60 },
            { label: 'comp',     grade: 'D',  pct: 40 },
            { label: 'stage',    grade: 'A-', pct: 82 },
            { label: 'location', grade: 'A+', pct: 100 },
          ]} />
        </div>

        {/* Salary */}
        <div style={{ background: 'var(--lm-canvas)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-signal)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
              ★ SALARY CHECK
            </div>
            <span style={{
              padding: '3px 11px', borderRadius: 999,
              background: 'var(--lm-signal)', color: 'var(--lm-signal-on)',
              fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500,
            }}>
              ≈ 16% under market
            </span>
          </div>
          <SalaryBand
            amount="MXN $1.6M"
            label="THEIR OFFER"
            flag
            flagText="≈ 16% under market"
            market="MARKET $1.9–2.4M"
            confidence={3}
            bandStart={35}
            bandWidth={35}
            pinAt={22}
          />
          <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--lm-ink-2)', margin: 0 }}>
            &ldquo;Competitive&rdquo; is doing a lot of work in that DM. Market for Head of Ops at a Series C MX fintech: $1.9–2.4M MXN base.
          </p>
        </div>

        {/* Gap analysis */}
        <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
            GAP ANALYSIS
          </div>
          <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, color: 'var(--lm-ink)' }}>Light on:</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontFamily: 'var(--font-albert-sans)', fontSize: 13, lineHeight: 1.6, color: 'var(--lm-ink-2)' }}>
            <li>Lending-specific risk ops (Clip was payments)</li>
            <li>Series C stage scaling</li>
          </ul>
          <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, color: 'var(--lm-ink)' }}>Over-indexes on:</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontFamily: 'var(--font-albert-sans)', fontSize: 13, lineHeight: 1.6, color: 'var(--lm-ink-2)' }}>
            <li>P&L size (Clip ~2× Stori)</li>
            <li>Multi-country ops (Stori is MX-only)</li>
          </ul>
        </div>

        {/* Draft reply */}
        <div style={{ background: 'var(--lm-accent-soft)', border: '1px solid transparent', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-accent)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
              DRAFT REPLY
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['warm', 'cool', 'decline'].map((t, i) => (
                <span key={t} style={{
                  padding: '3px 11px', borderRadius: 999,
                  background: i === 0 ? 'var(--lm-ink)' : 'transparent',
                  color: i === 0 ? 'var(--lm-bg)' : 'var(--lm-ink-3)',
                  border: '1px solid var(--lm-line)',
                  fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500,
                }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            border: '1px dashed var(--lm-line)', background: 'var(--lm-surface)',
            fontFamily: 'var(--font-albert-sans)', fontSize: 13, lineHeight: 1.6, color: 'var(--lm-ink-2)',
          }}>
            Hi Rita — thanks for reaching out. Open to the right conversation. Before a call — could you share the target base range and whether the role owns credit risk or sits adjacent?
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            <button style={{
              padding: '6px 14px', borderRadius: 999,
              border: '1px solid var(--lm-line)', background: 'var(--lm-surface)',
              fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500,
              color: 'var(--lm-ink)', cursor: 'pointer',
            }}>
              Edit
            </button>
            <button style={{
              padding: '6px 14px', borderRadius: 999,
              border: 'none', background: 'transparent',
              fontFamily: 'var(--font-albert-sans)', fontSize: 12,
              color: 'var(--lm-ink-3)', cursor: 'pointer',
            }}>
              Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
