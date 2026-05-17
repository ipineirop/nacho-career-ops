'use client';

import { useState } from 'react';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { PortalsSection } from '@/components/settings/PortalsSection';
import { CredentialsSection } from '@/components/settings/CredentialsSection';
import { NarrativeSection } from '@/components/settings/NarrativeSection';
import { FitBars } from '@/components/ui/fit-bars';

const TABS = [
  { id: 'profile',     label: 'Profile' },
  { id: 'portals',     label: 'Sources & axes' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'narrative',   label: 'Narrative' },
] as const;

type Tab = typeof TABS[number]['id'];

const SOURCES = [
  { label: 'OCC · 312 cos',     tag: '★', on: true  },
  { label: 'Bumeran · MX/AR/CO', tag: '★', on: true  },
  { label: 'Computrabajo',       tag: '★', on: true  },
  { label: 'LinkedIn Jobs LatAm', tag: '★', on: true  },
  { label: 'Greenhouse · 42 cos', tag: '',  on: true  },
  { label: 'Ashby · 18 cos',     tag: '',  on: true  },
  { label: 'Lever · 11 cos',     tag: '',  on: true  },
  { label: 'Wellfound',          tag: '',  on: false },
];

const WEIGHTS = [
  { label: 'scope',    grade: 'A',  pct: 90, pct_label: '25%' },
  { label: 'level',    grade: 'A-', pct: 80, pct_label: '20%' },
  { label: 'domain',   grade: 'B+', pct: 70, pct_label: '15%' },
  { label: 'comp',     grade: 'B',  pct: 60, pct_label: '15%' },
  { label: 'stage',    grade: 'C+', pct: 45, pct_label: '10%' },
  { label: 'location', grade: 'C',  pct: 40, pct_label: '10%' },
  { label: 'trajecto', grade: 'C-', pct: 20, pct_label: '5%'  },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div style={{ padding: '32px', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 32, color: 'var(--lm-ink)', margin: 0, letterSpacing: '-0.8px' }}>
        Settings
      </h1>

      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: '6px 16px', borderRadius: 999,
              border: '1px solid var(--lm-line)',
              background: tab === id ? 'var(--lm-ink)' : 'var(--lm-surface)',
              color: tab === id ? 'var(--lm-bg)' : 'var(--lm-ink-2)',
              fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'profile'     && <ProfileSection />}
      {tab === 'credentials' && <CredentialsSection />}
      {tab === 'narrative'   && <NarrativeSection />}

      {tab === 'portals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Sources */}
          <div style={{
            background: 'var(--lm-surface)', border: '1px solid var(--lm-line)',
            borderRadius: 10, padding: '22px 24px',
          }}>
            <h2 className="font-editorial" style={{ fontSize: 28, color: 'var(--lm-ink)', margin: '0 0 6px', lineHeight: 1.1 }}>
              Where I scout for you.
            </h2>
            <p style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 14.5, color: 'var(--lm-ink-2)', margin: '0 0 18px', lineHeight: 1.55 }}>
              LatAm sources are on by default. Add any careers page by URL.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {SOURCES.map((s) => (
                <div key={s.label} style={{
                  padding: '8px 14px', borderRadius: 10,
                  border: '1px solid var(--lm-line)',
                  background: s.on ? 'var(--lm-accent-soft)' : 'var(--lm-canvas)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {s.tag && <span style={{ color: 'var(--lm-accent)', fontSize: 12 }}>★</span>}
                  <span style={{
                    fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 500,
                    color: s.on ? 'var(--lm-accent)' : 'var(--lm-ink-3)',
                  }}>
                    {s.label}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-geist-mono)', fontSize: 10,
                    color: s.on ? 'var(--lm-accent)' : 'var(--lm-ink-3)',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    {s.on ? 'on' : 'off'}
                  </span>
                </div>
              ))}
              <div style={{
                padding: '8px 14px', borderRadius: 10,
                border: '1px dashed var(--lm-line)', background: 'transparent',
              }}>
                <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)' }}>
                  + Paste careers page URL
                </span>
              </div>
            </div>
          </div>

          {/* Score weights */}
          <div style={{
            background: 'var(--lm-canvas)', border: '1px solid var(--lm-line)',
            borderRadius: 10, padding: '22px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 18, color: 'var(--lm-ink)', margin: 0 }}>
                Score weights — your axes
              </h3>
              <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)' }}>
                changes apply to next scan
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {/* Weights */}
              <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>
                  YOUR WEIGHTS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {WEIGHTS.map((w) => (
                    <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 70, fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        {w.label}
                      </span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--lm-track)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${w.pct}%`, background: 'var(--lm-accent)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--lm-ink-3)', width: 30, textAlign: 'right' }}>{w.pct_label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Currency */}
              <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  CURRENCY & COMP
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)' }}>show salaries in</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['USD', 'MXN'].map((c, i) => (
                      <span key={c} style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid var(--lm-line)', background: i === 1 ? 'var(--lm-ink)' : 'var(--lm-surface)', color: i === 1 ? 'var(--lm-bg)' : 'var(--lm-ink-2)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, cursor: 'pointer' }}>{c}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)' }}>floor (never show below)</span>
                  <span style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid var(--lm-line)', background: 'var(--lm-surface)', fontFamily: 'var(--font-geist-mono)', fontSize: 12, color: 'var(--lm-ink)' }}>$1.9M MXN</span>
                </div>
              </div>

              {/* Cadence */}
              <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  CADENCE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)' }}>brief delivery</span>
                  <span style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid var(--lm-line)', background: 'var(--lm-ink)', color: 'var(--lm-bg)', fontFamily: 'var(--font-albert-sans)', fontSize: 12 }}>daily 8am CST</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)' }}>max picks / brief</span>
                  <span style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid var(--lm-line)', background: 'var(--lm-ink)', color: 'var(--lm-bg)', fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>7</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)' }}>stale nudge after</span>
                  <span style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid var(--lm-line)', background: 'var(--lm-surface)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink)' }}>5 days</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button style={{ padding: '7px 16px', borderRadius: 999, border: 'none', background: 'transparent', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-3)', cursor: 'pointer' }}>
                Reset to defaults
              </button>
              <button style={{ padding: '7px 16px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', border: 'none', fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
