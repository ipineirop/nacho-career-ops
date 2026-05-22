'use client';

import { useState } from 'react';

export interface PastEmployerMatchView {
  resolved_canonical_id: string | null;
  matches_user_past_employer: boolean;
  surface: boolean;
  role_company_input?: string;
  matches_via?: {
    past_employer_display: string;
    canonical_id: string | null;
    date_range: string;
    relation: 'direct' | 'acquisition_lineage' | 'subsidiary';
  };
}

export interface VerdictMeta {
  evaluationId: string;
  roleId: string;
  pastEmployerMatch: PastEmployerMatchView | null;
  patternHits: string[];
  pastEmployers: Array<{ canonicalId: string | null; displayName: string; dateRange: string }>;
}

const BuildingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
  </svg>
);

function lineCopy(m: PastEmployerMatchView): string {
  const v = m.matches_via;
  if (!v) return '';
  const range = v.date_range ? ` ${v.date_range}` : '';
  if (v.relation === 'acquisition_lineage') {
    return `This role traces back to ${v.past_employer_display}, where you worked${range}.`;
  }
  return `This is at ${v.past_employer_display}, where you worked${range}.`;
}

export function VerdictSurfaces({ meta }: { meta: VerdictMeta }) {
  const [match, setMatch] = useState<PastEmployerMatchView | null>(meta.pastEmployerMatch);
  const [dismissed, setDismissed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const showLine = !!match && match.surface && match.matches_user_past_employer && !dismissed;

  async function suppress() {
    if (busy) return;
    setBusy(true);
    setDismissed(true);
    try {
      await fetch(`/api/evaluations/${meta.evaluationId}/suppress-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalId: match?.resolved_canonical_id ?? null,
          roleCompanyInput: match?.role_company_input ?? null,
        }),
      });
    } catch { /* optimistic — already collapsed */ }
    setBusy(false);
  }

  async function manualMatch(emp: VerdictMeta['pastEmployers'][number]) {
    if (busy) return;
    setBusy(true);
    setPickerOpen(false);
    try {
      const res = await fetch(`/api/evaluations/${meta.evaluationId}/manual-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalId: emp.canonicalId, displayName: emp.displayName, dateRange: emp.dateRange }),
      });
      if (res.ok) {
        setDismissed(false);
        setMatch({
          resolved_canonical_id: emp.canonicalId,
          matches_user_past_employer: true,
          surface: true,
          matches_via: { past_employer_display: emp.displayName, canonical_id: emp.canonicalId, date_range: emp.dateRange, relation: 'direct' },
        });
      }
    } catch { /* leave as-is */ }
    setBusy(false);
  }

  const card: React.CSSProperties = {
    display: 'flex', gap: 11, alignItems: 'flex-start',
    padding: '13px 15px', borderRadius: 10,
    background: 'var(--lm-canvas)', border: '1px solid var(--lm-line)',
    fontFamily: 'var(--font-albert-sans)', fontSize: 13.5, color: 'var(--lm-ink)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* §3.5a past-employer line + §5.1 not-the-same */}
      {showLine && match && (
        <div style={card}>
          <span style={{ color: 'var(--lm-accent)', flex: 'none', marginTop: 1 }}><BuildingIcon /></span>
          <div style={{ flex: 1 }}>
            <span>{lineCopy(match)}</span>
            <div style={{ marginTop: 7 }}>
              <button
                onClick={suppress}
                disabled={busy}
                style={{ border: 0, background: 'none', color: 'var(--lm-ink-3)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, padding: 0 }}
              >
                not the same
              </button>
            </div>
          </div>
        </div>
      )}

      {/* §5.1 confirmation after dismiss */}
      {dismissed && match && (
        <div style={{ ...card, color: 'var(--lm-ink-3)', fontStyle: 'italic' }}>
          <div style={{ flex: 1 }}>Got it — won&apos;t flag this match again.</div>
        </div>
      )}

      {/* §5.2 "this is actually at a past employer" — when nothing surfaced */}
      {!showLine && !dismissed && meta.pastEmployers.length > 0 && (
        <div>
          <button
            onClick={() => setPickerOpen((o) => !o)}
            style={{ border: 0, background: 'none', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, padding: 0 }}
          >
            This is actually at one of my past employers
          </button>
          {pickerOpen && (
            <div style={{ marginTop: 12, padding: 14, border: '1px dashed var(--lm-line)', borderRadius: 10, background: 'var(--lm-canvas)' }}>
              <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 500, fontSize: 13, marginBottom: 9, color: 'var(--lm-ink)' }}>Which one?</div>
              {meta.pastEmployers.map((e, i) => (
                <button
                  key={`${e.displayName}-${i}`}
                  onClick={() => manualMatch(e)}
                  disabled={busy}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid var(--lm-line)', background: 'var(--lm-surface)', borderRadius: 8, padding: '9px 12px', marginBottom: 6, fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', cursor: 'pointer' }}
                >
                  {e.displayName}{e.dateRange ? ` · ${e.dateRange}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* §3.5b pattern hits */}
      {meta.patternHits.length > 0 && (
        <div style={{ padding: '18px 18px 16px', border: '1px solid var(--lm-signal-soft)', background: 'color-mix(in srgb, var(--lm-signal-soft) 45%, var(--lm-surface))', borderRadius: 12 }}>
          <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, color: 'var(--lm-ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ color: 'var(--lm-signal)' }}>★</span> Pattern hits — things you said you&apos;re avoiding
          </div>
          <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {meta.patternHits.map((h, i) => (
              <li key={i} style={{ color: 'var(--lm-ink-2)', fontFamily: 'var(--font-albert-sans)', fontSize: 13.5 }}>— {h}</li>
            ))}
          </ul>
          <div style={{ marginTop: 13, fontSize: 12.5, color: 'var(--lm-ink-3)', fontStyle: 'italic' }}>The score above factors these in.</div>
        </div>
      )}
    </div>
  );
}
