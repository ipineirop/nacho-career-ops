'use client';

import { useEffect, useState } from 'react';

interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  htmlLink: string;
}

function formatDateTime(iso: string) {
  if (!iso) return '';
  // Date-only (all-day)
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const d = new Date(iso);
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function daysUntil(iso: string) {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export default function CalendarPage() {
  const [state, setState] = useState<'loading' | 'disconnected' | 'connected'>('loading');
  const [events, setEvents] = useState<CalEvent[]>([]);

  useEffect(() => {
    fetch('/api/calendar-events')
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setState('connected');
          setEvents(data.events ?? []);
        } else {
          setState('disconnected');
        }
      })
      .catch(() => setState('disconnected'));
  }, []);

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 24, color: 'var(--lm-ink)', margin: 0 }}>
          Interviews
        </h1>
        <span style={{ padding: '4px 12px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500 }}>
          Google Calendar · next 30 days
        </span>
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
              Connect your <em>Calendar</em>.
            </h2>
            <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14.5, color: 'var(--lm-ink-2)', margin: 0, lineHeight: 1.6 }}>
              See upcoming interviews, screens, and recruiter calls without leaving your job search dashboard.
            </p>
          </div>

          <div style={{ background: 'var(--lm-canvas)', border: '1px solid var(--lm-line)', borderRadius: 8, padding: '14px 18px', width: '100%' }}>
            <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13.5, color: 'var(--lm-ink)', margin: 0 }}>
              Connect Gmail first — Calendar uses the same Google OAuth credentials. Once connected via Gmail, your calendar events will appear here automatically.
            </p>
          </div>

          <a href="/api/auth/google" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 22px', borderRadius: 999,
            background: 'var(--lm-accent)', color: 'var(--lm-accent-on)',
            fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 600,
            textDecoration: 'none',
          }}>
            ✦ Connect Google
          </a>
        </div>
      )}

      {state === 'connected' && (
        <>
          <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)' }}>
            {events.length} interview-related events in the next 30 days
          </div>

          {events.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', border: '1px dashed var(--lm-line)', borderRadius: 10 }}>
              <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14, color: 'var(--lm-ink-3)', margin: 0 }}>
                No upcoming interviews found. You're in between rounds — keep applying.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.map((e) => {
              const days = daysUntil(e.start);
              const urgent = days !== null && days <= 1;
              return (
                <a key={e.id} href={e.htmlLink} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: urgent ? 'var(--lm-signal-soft)' : 'var(--lm-surface)',
                    border: `1px solid ${urgent ? 'var(--lm-signal)' : 'var(--lm-line)'}`,
                    borderRadius: 10, padding: '16px 18px',
                    display: 'flex', gap: 16, alignItems: 'flex-start',
                  }}>
                    {/* Date block */}
                    <div style={{
                      flexShrink: 0, width: 52, textAlign: 'center',
                      background: urgent ? 'var(--lm-signal)' : 'var(--lm-canvas)',
                      borderRadius: 8, padding: '8px 4px',
                    }}>
                      <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 9, color: urgent ? 'white' : 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        {days === 0 ? 'TODAY' : days === 1 ? 'TMRW' : `${days}d`}
                      </div>
                      <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 20, fontWeight: 700, color: urgent ? 'white' : 'var(--lm-ink)', lineHeight: 1.1 }}>
                        {new Date(e.start.length === 10 ? e.start + 'T00:00:00' : e.start).getDate()}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 15, color: 'var(--lm-ink)', marginBottom: 4 }}>
                        {e.title}
                      </div>
                      <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)' }}>
                        {formatDateTime(e.start)}
                        {e.location && <span style={{ marginLeft: 8 }}>· {e.location}</span>}
                      </div>
                      {e.description && (
                        <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12.5, color: 'var(--lm-ink-2)', marginTop: 6, lineHeight: 1.5 }}>
                          {e.description}
                        </div>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
