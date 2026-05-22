'use client';

import { useState, useEffect, useMemo } from 'react';
import { StreamingOutput } from '@/components/ai/StreamingOutput';
import { VerdictView } from '@/components/verdict/VerdictView';
import type { FullVerdictMeta } from '@/components/verdict/types';

type InputMode = 'dm' | 'url' | 'jd';

export default function EvaluatePage() {
  const [inputMode, setInputMode] = useState<InputMode>('dm');
  const [jd, setJd] = useState('');
  const [stream, setStream] = useState<ReadableStream<Uint8Array> | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const isDark = theme === 'dark';

  // Split the structured trailer (past-employer match, pattern hits, etc.) off
  // the markdown body so it isn't rendered as text.
  const { displayText, meta } = useMemo(() => {
    const m = streamText.match(/<!--LABRA_META:([\s\S]*?)-->/);
    if (!m) return { displayText: streamText, meta: null as FullVerdictMeta | null };
    let parsed: FullVerdictMeta | null = null;
    try { parsed = JSON.parse(m[1]) as FullVerdictMeta; } catch { parsed = null; }
    return { displayText: streamText.replace(m[0], '').trimEnd(), meta: parsed };
  }, [streamText]);

  useEffect(() => {
    if (!stream) {
      return;
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    async function read() {
      try {
        while (true) {
          const { done: isDone, value } = await reader.read();
          if (isDone) {
            setDone(true);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          setStreamText(accumulated);
        }
      } catch (err) {
        console.error('Stream read error:', err);
      }
    }

    void read();
    return () => {
      reader.cancel().catch(() => {});
    };
  }, [stream]);

  async function handleRun() {
    if (!jd.trim() || loading) return;
    setLoading(true);
    setDone(false);
    setStream(null);
    setStreamText('');
    try {
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd, source: inputMode }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (!res.body) throw new Error('No response body');

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
    setStreamText('');
    setDone(false);
  }

  const INPUT_LABELS: Record<InputMode, string> = {
    dm: 'Recruiter DM',
    url: 'Role URL',
    jd: 'Role Details',
  };

  const PLACEHOLDERS: Record<InputMode, string> = {
    dm: 'Paste a recruiter message — "Hi Nacho! We just opened a Head of Ops seat…"',
    url: 'https://careers.company.com/jobs/director-operations',
    jd: 'Paste the full role details here…',
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

      {/* While evaluating: stream the canonical A–G report as the "working" view */}
      {(stream || streamText) && !(done && meta?.verdict) && (
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
          <StreamingOutput text={displayText} isDone={done} onComplete={() => setDone(true)} />
          {/* Fallback: stream finished but no structured verdict parsed */}
          {done && !meta?.verdict && (
            <div style={{ display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid var(--lm-line)' }}>
              <button onClick={handleClear} style={{
                padding: '9px 16px', borderRadius: 999,
                border: '1px solid var(--lm-line)', background: 'var(--lm-surface)',
                fontFamily: 'var(--font-albert-sans)', fontSize: 13,
                color: 'var(--lm-ink)', cursor: 'pointer',
              }}>
                New evaluation
              </button>
            </div>
          )}
        </div>
      )}

      {/* Done: the editorial verdict */}
      {done && meta?.verdict && (
        <VerdictView meta={meta} onNew={handleClear} onDiscard={handleClear} />
      )}

    </div>
  );
}
