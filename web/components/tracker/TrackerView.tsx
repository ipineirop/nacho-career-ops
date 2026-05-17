'use client';

import { useState } from 'react';
import { KanbanBoard } from './KanbanBoard';

interface AppRow {
  id: number;
  date: string;
  company: string;
  role: string;
  scoreNum: number;
  status: string;
  reportId: string | null;
  score: string;
  hasPdf: boolean;
  notes: string;
}

export function TrackerView({ children, apps }: { children: React.ReactNode; apps: AppRow[] }) {
  const [view, setView] = useState<'list' | 'kanban'>('list');

  return (
    <>
      {/* View toggle injected into the topbar — placed via sibling */}
      <div style={{ display: 'flex', gap: 2, padding: '4px', borderRadius: 8, background: 'var(--lm-canvas)', border: '1px solid var(--lm-line)' }}>
        {(['list', 'kanban'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '4px 12px', borderRadius: 6, border: 'none',
              background: view === v ? 'var(--lm-ink)' : 'transparent',
              color: view === v ? 'var(--lm-bg)' : 'var(--lm-ink-3)',
              fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.1s',
            }}
          >
            {v === 'list' ? '≡ List' : '⊞ Board'}
          </button>
        ))}
      </div>
      {view === 'list' ? children : (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <KanbanBoard applications={apps} />
        </div>
      )}
    </>
  );
}
