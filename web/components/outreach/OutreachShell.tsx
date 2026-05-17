'use client';

import { useState, useRef } from 'react';

interface App { id: string; company: string; role: string; status: string | null; }

const MSG_TYPES = [
  { id: 'linkedin', label: 'LinkedIn message', limit: '300 chars' },
  { id: 'email',    label: 'Cold email',        limit: '4 sentences' },
  { id: 'followup', label: 'Follow-up',         limit: '3 sentences' },
] as const;

type MsgType = typeof MSG_TYPES[number]['id'];
type Tab = 'outreach' | 'research';

export function OutreachShell({ applications }: { applications: App[] }) {
  const [tab, setTab] = useState<Tab>('outreach');

  // Outreach state
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [contactType, setContactType] = useState('Hiring Manager');
  const [msgType, setMsgType] = useState<MsgType>('linkedin');
  const [jd, setJd] = useState('');
  const [outreachText, setOutreachText] = useState('');
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Research state
  const [resCompany, setResCompany] = useState('');
  const [resJd, setResJd] = useState('');
  const [resText, setResText] = useState('');
  const [resLoading, setResLoading] = useState(false);

  function pickApp(app: App) {
    setSelectedApp(app);
    setCompany(app.company);
    setRole(app.role);
  }

  async function generateOutreach() {
    const co = company.trim() || selectedApp?.company;
    const ro = role.trim() || selectedApp?.role;
    if (!co) return;
    setOutreachLoading(true);
    setOutreachText('');
    try {
      const res = await fetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: co, role: ro, contactType, jd, type: msgType }),
      });
      if (!res.ok || !res.body) throw new Error('Request failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setOutreachText(acc);
      }
    } finally {
      setOutreachLoading(false);
    }
  }

  async function generateResearch() {
    const co = resCompany.trim();
    if (!co) return;
    setResLoading(true);
    setResText('');
    try {
      const res = await fetch('/api/ai/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: co, jd: resJd }),
      });
      if (!res.ok || !res.body) throw new Error('Request failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setResText(acc);
      }
    } finally {
      setResLoading(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 20px', borderBottom: '1px solid var(--lm-line)',
        background: 'var(--lm-surface)', flexWrap: 'wrap',
      }}>
        <h1 style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 18, color: 'var(--lm-ink)', margin: 0 }}>
          Network
        </h1>
        <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 8, background: 'var(--lm-canvas)', border: '1px solid var(--lm-line)' }}>
          {(['outreach', 'research'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '4px 14px', borderRadius: 6, border: 'none',
              background: tab === t ? 'var(--lm-ink)' : 'transparent',
              color: tab === t ? 'var(--lm-bg)' : 'var(--lm-ink-3)',
              fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', textTransform: 'capitalize',
            }}>
              {t === 'outreach' ? '✉ Outreach' : '◎ Research'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', gap: 20 }} className="flex-col lg:flex-row">

        {tab === 'outreach' && (
          <>
            {/* Left panel — controls */}
            <div style={{ width: '100%', maxWidth: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Pick from tracker */}
              {applications.length > 0 && (
                <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    From your tracker
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {applications.slice(0, 12).map((app) => (
                      <button key={app.id} onClick={() => pickApp(app)} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        padding: '8px 10px', borderRadius: 8, border: '1px solid var(--lm-line)',
                        background: selectedApp?.id === app.id ? 'var(--lm-accent-soft)' : 'var(--lm-canvas)',
                        cursor: 'pointer', textAlign: 'left',
                      }}>
                        <span style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 13, color: selectedApp?.id === app.id ? 'var(--lm-accent)' : 'var(--lm-ink)' }}>
                          {app.company}
                        </span>
                        <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)' }}>
                          {app.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Or type manually */}
              <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Or type manually
                </span>
                <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name"
                  style={{ border: '1px solid var(--lm-line)', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', background: 'var(--lm-canvas)', outline: 'none' }} />
                <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (optional)"
                  style={{ border: '1px solid var(--lm-line)', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', background: 'var(--lm-canvas)', outline: 'none' }} />
                <input value={contactType} onChange={(e) => setContactType(e.target.value)} placeholder="Contact type (e.g. Hiring Manager)"
                  style={{ border: '1px solid var(--lm-line)', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', background: 'var(--lm-canvas)', outline: 'none' }} />
              </div>

              {/* Message type */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MSG_TYPES.map((mt) => (
                  <button key={mt.id} onClick={() => setMsgType(mt.id)} style={{
                    padding: '6px 14px', borderRadius: 999, border: '1px solid var(--lm-line)',
                    background: msgType === mt.id ? 'var(--lm-ink)' : 'var(--lm-surface)',
                    color: msgType === mt.id ? 'var(--lm-bg)' : 'var(--lm-ink-2)',
                    fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}>
                    {mt.label}
                    <span style={{ marginLeft: 6, fontFamily: 'var(--font-geist-mono)', fontSize: 10, opacity: 0.6 }}>{mt.limit}</span>
                  </button>
                ))}
              </div>

              {/* JD context */}
              <textarea value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste JD or job context (optional — improves quality)"
                rows={4}
                style={{ border: '1px solid var(--lm-line)', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', background: 'var(--lm-canvas)', outline: 'none', resize: 'vertical' }} />

              <button
                onClick={generateOutreach}
                disabled={outreachLoading || !((company.trim() || selectedApp?.company))}
                style={{
                  padding: '10px 20px', borderRadius: 999, border: 'none',
                  background: outreachLoading ? 'var(--lm-line)' : 'var(--lm-accent)',
                  color: outreachLoading ? 'var(--lm-ink-3)' : 'var(--lm-accent-on)',
                  fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 600,
                  cursor: outreachLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {outreachLoading ? '✦ Drafting…' : '✦ Draft message'}
              </button>
            </div>

            {/* Right panel — output */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {outreachText ? (
                <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {MSG_TYPES.find((m) => m.id === msgType)?.label} · {company || selectedApp?.company}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => copyText(outreachText)} style={{
                        padding: '5px 14px', borderRadius: 999, border: '1px solid var(--lm-line)',
                        background: copied ? 'var(--lm-accent-soft)' : 'var(--lm-canvas)',
                        color: copied ? 'var(--lm-accent)' : 'var(--lm-ink-2)',
                        fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer',
                      }}>
                        {copied ? '✓ Copied' : 'Copy'}
                      </button>
                      <button onClick={generateOutreach} disabled={outreachLoading} style={{
                        padding: '5px 14px', borderRadius: 999, border: 'none',
                        background: 'var(--lm-canvas)', color: 'var(--lm-ink-3)',
                        fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer',
                      }}>
                        Retry ↻
                      </button>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, lineHeight: 1.65, color: 'var(--lm-ink)', whiteSpace: 'pre-wrap' }}>
                    {outreachText}
                    {outreachLoading && <span style={{ display: 'inline-block', width: 2, height: 16, background: 'var(--lm-accent)', marginLeft: 2, verticalAlign: 'middle', animation: 'pulse 1s infinite' }} />}
                  </div>
                  {!outreachLoading && (
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)' }}>
                      {outreachText.length} chars
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  height: '100%', minHeight: 280, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12,
                  border: '1px dashed var(--lm-line)', borderRadius: 10,
                  color: 'var(--lm-ink-3)',
                }}>
                  <span style={{ fontSize: 28 }}>✉</span>
                  <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14 }}>
                    Pick a company and draft a message
                  </span>
                  <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)', maxWidth: 260, textAlign: 'center' }}>
                    I'll write a message that leads with your value, not your job-seeking status.
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'research' && (
          <>
            {/* Left panel */}
            <div style={{ width: '100%', maxWidth: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Company to research
                </span>
                <input value={resCompany} onChange={(e) => setResCompany(e.target.value)} placeholder="Company name"
                  style={{ border: '1px solid var(--lm-line)', borderRadius: 8, padding: '8px 12px', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', background: 'var(--lm-canvas)', outline: 'none' }} />
              </div>

              {/* Quick-pick from tracker */}
              {applications.length > 0 && (
                <div style={{ background: 'var(--lm-canvas)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Quick-pick
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[...new Set(applications.map((a) => a.company))].slice(0, 8).map((co) => (
                      <button key={co} onClick={() => setResCompany(co)} style={{
                        padding: '4px 12px', borderRadius: 999, border: '1px solid var(--lm-line)',
                        background: resCompany === co ? 'var(--lm-ink)' : 'var(--lm-surface)',
                        color: resCompany === co ? 'var(--lm-bg)' : 'var(--lm-ink-2)',
                        fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer',
                      }}>{co}</button>
                    ))}
                  </div>
                </div>
              )}

              <textarea value={resJd} onChange={(e) => setResJd(e.target.value)} placeholder="Paste JD for targeted research (optional)"
                rows={5}
                style={{ border: '1px solid var(--lm-line)', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', background: 'var(--lm-canvas)', outline: 'none', resize: 'vertical' }} />

              <button onClick={generateResearch} disabled={resLoading || !resCompany.trim()} style={{
                padding: '10px 20px', borderRadius: 999, border: 'none',
                background: resLoading ? 'var(--lm-line)' : 'var(--lm-accent)',
                color: resLoading ? 'var(--lm-ink-3)' : 'var(--lm-accent-on)',
                fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 600,
                cursor: resLoading ? 'not-allowed' : 'pointer',
              }}>
                {resLoading ? '◎ Researching…' : '◎ Research company'}
              </button>
            </div>

            {/* Right panel — output */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {resText ? (
                <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {resLoading ? '◎ Researching…' : `◎ ${resCompany} — intel report`}
                    </span>
                    <button onClick={() => copyText(resText)} style={{
                      padding: '5px 14px', borderRadius: 999, border: '1px solid var(--lm-line)',
                      background: 'var(--lm-canvas)', color: 'var(--lm-ink-2)',
                      fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer',
                    }}>Copy</button>
                  </div>
                  <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, lineHeight: 1.7, color: 'var(--lm-ink)', whiteSpace: 'pre-wrap' }}>
                    {resText}
                    {resLoading && <span style={{ display: 'inline-block', width: 2, height: 16, background: 'var(--lm-accent)', marginLeft: 2, verticalAlign: 'middle' }} />}
                  </div>
                </div>
              ) : (
                <div style={{
                  height: '100%', minHeight: 280, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12,
                  border: '1px dashed var(--lm-line)', borderRadius: 10, color: 'var(--lm-ink-3)',
                }}>
                  <span style={{ fontSize: 28 }}>◎</span>
                  <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14 }}>Company intel, on demand</span>
                  <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)', maxWidth: 280, textAlign: 'center' }}>
                    I'll compile what's worth knowing: stage, culture signals, red flags, and how to position yourself.
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
