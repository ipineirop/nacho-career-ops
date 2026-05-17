'use client';

import { useEffect, useState } from 'react';

interface Thread {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  messageCount: number;
}

function fromName(from: string) {
  const m = from.match(/^(.+?)\s*</) ?? from.match(/([^@]+)@/);
  return m?.[1]?.trim().replace(/"/g, '') ?? from;
}

function relativeDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function GmailPage() {
  const [state, setState] = useState<'loading' | 'disconnected' | 'connected'>('loading');
  const [threads, setThreads] = useState<Thread[]>([]);
  const hasGoogle = !!process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED;

  useEffect(() => {
    fetch('/api/gmail')
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setState('connected');
          setThreads(data.threads ?? []);
        } else {
          setState('disconnected');
        }
      })
      .catch(() => setState('disconnected'));
  }, []);

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 24, color: 'var(--lm-ink)', margin: 0 }}>
          Inbox
        </h1>
        <span style={{ padding: '4px 12px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500 }}>
          Gmail · job threads
        </span>
        {state === 'connected' && (
          <button onClick={() => fetch('/api/gmail').then((r) => r.json()).then((d) => { if (d.connected) setThreads(d.threads); })}
            style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 999, border: '1px solid var(--lm-line)', background: 'var(--lm-canvas)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-2)', cursor: 'pointer' }}>
            Refresh ↻
          </button>
        )}
      </div>

      {state === 'loading' && (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--lm-ink-3)', fontFamily: 'var(--font-albert-sans)', fontSize: 14 }}>
          Loading…
        </div>
      )}

      {state === 'disconnected' && (
        <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '32px', display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'flex-start' }}>
          <div>
            <h2 className="font-editorial" style={{ fontSize: 32, color: 'var(--lm-ink)', margin: '0 0 8px', lineHeight: 1.1 }}>
              Connect your <em>Gmail</em>.
            </h2>
            <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14.5, color: 'var(--lm-ink-2)', margin: 0, lineHeight: 1.6 }}>
              I'll surface job-related threads — recruiter outreach, interview invites, offer letters — without you having to dig through your inbox.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            {[
              { n: 1, text: 'Go to Google Cloud Console → Create project → Enable Gmail API + Calendar API' },
              { n: 2, text: 'Create OAuth 2.0 Client ID (Web application) → Add authorized redirect URI:' },
              { n: 3, text: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Vercel env vars → Redeploy' },
              { n: 4, text: 'Click "Connect Gmail" below' },
            ].map((step) => (
              <div key={step.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--lm-canvas)', borderRadius: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999, background: 'var(--lm-ink)', color: 'var(--lm-bg)', fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, flexShrink: 0, marginTop: 1 }}>
                  {step.n}
                </span>
                <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13.5, color: 'var(--lm-ink)', lineHeight: 1.5 }}>
                  {step.text}
                  {step.n === 2 && (
                    <code style={{ display: 'block', marginTop: 4, padding: '4px 10px', background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 6, fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--lm-accent)' }}>
                      https://nacho-career-ops.vercel.app/api/auth/google/callback
                    </code>
                  )}
                </span>
              </div>
            ))}
          </div>

          <a href="/api/auth/google" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 22px', borderRadius: 999,
            background: 'var(--lm-accent)', color: 'var(--lm-accent-on)',
            fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 600,
            textDecoration: 'none',
          }}>
            ✦ Connect Gmail
          </a>

          <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)', margin: 0 }}>
            Read-only access. I never send emails or modify your inbox.
          </p>
        </div>
      )}

      {state === 'connected' && (
        <>
          <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)' }}>
            {threads.length} job-related threads · last 30 days
          </div>

          {threads.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', border: '1px dashed var(--lm-line)', borderRadius: 10 }}>
              <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-ink-3)', margin: 0 }}>
                No recent job-related emails found. Check back after applying to some roles.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {threads.map((t) => (
              <div key={t.id} style={{
                background: 'var(--lm-surface)', border: '1px solid var(--lm-line)',
                borderRadius: 8, padding: '14px 18px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 999, flexShrink: 0,
                    background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 11,
                  }}>
                    {fromName(t.from).slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, color: 'var(--lm-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subject || '(no subject)'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)' }}>
                      {fromName(t.from)}
                      {t.messageCount > 1 && (
                        <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 999, background: 'var(--lm-line)', fontFamily: 'var(--font-geist-mono)', fontSize: 10 }}>
                          {t.messageCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--lm-ink-3)', flexShrink: 0 }}>
                    {relativeDate(t.date)}
                  </span>
                </div>
                {t.snippet && (
                  <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 44 }}>
                    {t.snippet}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
