'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScoreChip } from '@/components/ui/score-chip';
import { StatusDot } from '@/components/ui/status-dot';
import { KanbanBoard } from './KanbanBoard';

type StatusType = 'draft' | 'applied' | 'interview' | 'offer' | 'passed';

function statusToType(status: string): StatusType {
  const s = status.toLowerCase();
  if (s.includes('interview')) return 'interview';
  if (s.includes('offer')) return 'offer';
  if (s.includes('applied')) return 'applied';
  if (s.includes('reject') || s.includes('discard') || s.includes('skip') || s.includes('pass')) return 'passed';
  return 'draft';
}

const PIPELINE_STAGES = ['Assessing', 'Drafting', 'Applied', 'Interview', 'Offer'];

function stageIndex(status: string): number {
  const s = status.toLowerCase();
  if (s.includes('offer')) return 4;
  if (s.includes('interview')) return 3;
  if (s.includes('applied')) return 2;
  if (s.includes('draft') || s.includes('tailor') || s.includes('cv')) return 1;
  return 0;
}

interface AppRow {
  id: string; date: string; company: string; role: string;
  score: string; scoreNum: number; status: string;
  hasPdf: boolean; reportId: string | null; notes: string;
}

export function TrackerShell({ apps }: { apps: AppRow[] }) {
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const active = apps.filter((a) => !['passed', 'rejected', 'discarded', 'skip'].some((w) => a.status.toLowerCase().includes(w)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderBottom: '1px solid var(--lm-line)',
        background: 'var(--lm-surface)', flexWrap: 'wrap',
      }}>
        <h1 style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 18, color: 'var(--lm-ink)', margin: 0 }}>
          Pipeline · {active.length} active
        </h1>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 8, background: 'var(--lm-canvas)', border: '1px solid var(--lm-line)' }}>
          {(['list', 'kanban'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none',
              background: view === v ? 'var(--lm-ink)' : 'transparent',
              color: view === v ? 'var(--lm-bg)' : 'var(--lm-ink-3)',
              fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500,
              cursor: 'pointer',
            }}>
              {v === 'list' ? '≡ List' : '⊞ Board'}
            </button>
          ))}
        </div>

        {view === 'list' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['All', 'Assessing', 'Applied', 'Interview', 'Offer'].map((f, i) => (
              <span key={f} style={{
                padding: '4px 12px', borderRadius: 999,
                border: '1px solid var(--lm-line)',
                background: i === 0 ? 'var(--lm-ink)' : 'var(--lm-surface)',
                color: i === 0 ? 'var(--lm-bg)' : 'var(--lm-ink-2)',
                fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
              }}>{f}</span>
            ))}
          </div>
        )}

        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {['USD', 'MXN'].map((c, i) => (
            <span key={c} style={{
              padding: '4px 12px', borderRadius: 999,
              border: '1px solid var(--lm-line)',
              background: i === 1 ? 'var(--lm-ink)' : 'var(--lm-surface)',
              color: i === 1 ? 'var(--lm-bg)' : 'var(--lm-ink-2)',
              fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer',
            }}>{c}</span>
          ))}
        </span>
      </div>

      {/* Content */}
      {view === 'kanban' ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <KanbanBoard applications={apps} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Desktop table header */}
          <div className="hidden md:grid" style={{
            gridTemplateColumns: '1.6fr 1fr 0.55fr 0.45fr 80px',
            gap: 8, padding: '8px 20px',
            fontFamily: 'var(--font-geist-mono)', fontSize: 10, letterSpacing: '1px',
            textTransform: 'uppercase', color: 'var(--lm-ink-3)',
            borderBottom: '1px solid var(--lm-line)',
            background: 'var(--lm-canvas)',
          }}>
            <span>Company / Role</span><span>Status</span><span>Score</span><span>Date</span><span />
          </div>

          {apps.map((app) => (
            <div key={app.id}>
              {/* Desktop row */}
              <div className="hidden md:grid" style={{
                gridTemplateColumns: '1.6fr 1fr 0.55fr 0.45fr 80px',
                gap: 8, padding: '10px 20px',
                borderBottom: '1px dashed var(--lm-line)',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--lm-ink)' }}>{app.company}</span>
                  <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12.5, color: 'var(--lm-ink-2)' }}>{app.role}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusDot status={statusToType(app.status)} />
                  <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)' }}>{app.status}</span>
                </div>
                <div>
                  {app.scoreNum > 0 && <ScoreChip score={Math.round(app.scoreNum * 20)} size="sm" variant={app.scoreNum >= 4 ? 'default' : 'muted'} />}
                </div>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{app.date}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {app.reportId && <Link href={`/reports/${app.reportId}`} style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-accent)', textDecoration: 'none' }}>Report</Link>}
                </div>
              </div>

              {/* Mobile card */}
              <div className="md:hidden" style={{ padding: '12px 16px', borderBottom: '1px dashed var(--lm-line)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusDot status={statusToType(app.status)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, color: 'var(--lm-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.company}</div>
                  <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12.5, color: 'var(--lm-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.role}</div>
                  <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)', marginTop: 2 }}>{app.status} · {app.date}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  {app.scoreNum > 0 && <ScoreChip score={Math.round(app.scoreNum * 20)} size="sm" variant={app.scoreNum >= 4 ? 'default' : 'muted'} />}
                  {app.reportId && <Link href={`/reports/${app.reportId}`} style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-accent)', textDecoration: 'none' }}>Report →</Link>}
                </div>
              </div>
            </div>
          ))}

          {apps.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14.5, color: 'var(--lm-ink-3)', margin: 0 }}>No applications yet. Evaluate a lead to get started.</p>
            </div>
          )}

          {/* Journey view */}
          {apps.length > 0 && (
            <div style={{ margin: '16px', background: 'var(--lm-canvas)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
                <span style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 16, color: 'var(--lm-ink)' }}>Journey view</span>
                <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)' }}>{apps.length} total · as a route</span>
              </div>
              <div style={{ display: 'flex', marginBottom: 8, fontFamily: 'var(--font-geist-mono)', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--lm-ink-3)' }}>
                <div style={{ width: 120 }} />
                {PIPELINE_STAGES.map((s) => <div key={s} style={{ flex: 1 }}>{s}</div>)}
              </div>
              {apps.slice(0, 8).map((app) => {
                const stage = stageIndex(app.status);
                const statusT = statusToType(app.status);
                const lineColor = statusT === 'offer' ? 'var(--lm-ink)' : statusT === 'interview' ? 'var(--lm-accent)' : statusT === 'applied' ? 'var(--lm-signal)' : 'var(--lm-line)';
                const progress = (stage + 0.5) / PIPELINE_STAGES.length;
                return (
                  <div key={app.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                    <div style={{ width: 120, flexShrink: 0, fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong>{app.company}</strong>
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: 18 }}>
                      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 2, background: 'var(--lm-line)' }} />
                      <div style={{ position: 'absolute', left: 0, width: `${progress * 100}%`, top: '50%', transform: 'translateY(-50%)', height: 2, background: lineColor }} />
                      <div style={{ position: 'absolute', left: `${progress * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 12, height: 12, borderRadius: '50%', background: lineColor, border: '2px solid var(--lm-bg)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
