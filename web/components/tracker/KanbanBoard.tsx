'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ScoreChip } from '@/components/ui/score-chip';

interface AppCard {
  id: number;
  company: string;
  role: string;
  status: string;
  scoreNum: number;
  date: string;
  reportId: string | null;
}

const COLUMNS: { id: string; label: string; statuses: string[]; targetStatus: string }[] = [
  { id: 'leads',     label: 'Leads',     statuses: ['evaluated'],                    targetStatus: 'Evaluated' },
  { id: 'applied',   label: 'Applied',   statuses: ['applied', 'responded'],         targetStatus: 'Applied' },
  { id: 'interview', label: 'Interview', statuses: ['interview'],                    targetStatus: 'Interview' },
  { id: 'offer',     label: 'Offer',     statuses: ['offer'],                        targetStatus: 'Offer' },
  { id: 'closed',    label: 'Closed',    statuses: ['rejected', 'discarded', 'skip', 'passed'], targetStatus: 'Discarded' },
];

function colFor(status: string): string {
  const s = status.toLowerCase();
  for (const col of COLUMNS) {
    if (col.statuses.some((w) => s.includes(w))) return col.id;
  }
  return 'leads';
}

export function KanbanBoard({ applications }: { applications: AppCard[] }) {
  const [cards, setCards] = useState(applications);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const dragCard = useRef<AppCard | null>(null);

  async function moveCard(cardId: number, targetColId: string) {
    const col = COLUMNS.find((c) => c.id === targetColId);
    if (!col) return;
    const newStatus = col.targetStatus;
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, status: newStatus } : c));
    await fetch('/api/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cardId, status: newStatus }),
    });
  }

  return (
    <div style={{ display: 'flex', gap: 10, height: '100%', overflowX: 'auto', padding: '16px 16px 0' }}>
      {COLUMNS.map((col) => {
        const colCards = cards.filter((c) => colFor(c.status) === col.id);
        const isDragOver = overCol === col.id;
        return (
          <div
            key={col.id}
            style={{
              flexShrink: 0,
              width: 240,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
            onDragLeave={() => setOverCol(null)}
            onDrop={async (e) => {
              e.preventDefault();
              setOverCol(null);
              if (dragCard.current) {
                await moveCard(dragCard.current.id, col.id);
                dragCard.current = null;
              }
              setDragId(null);
            }}
          >
            {/* Column header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', borderRadius: 8,
              background: isDragOver ? 'var(--lm-accent-soft)' : 'transparent',
              transition: 'background 0.15s',
            }}>
              <span style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: 10.5,
                color: isDragOver ? 'var(--lm-accent)' : 'var(--lm-ink-3)',
                letterSpacing: '1.2px', textTransform: 'uppercase',
                transition: 'color 0.15s',
              }}>
                {col.label}
              </span>
              <span style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: 11,
                color: 'var(--lm-ink-3)',
                background: 'var(--lm-line)', padding: '2px 8px', borderRadius: 999,
              }}>
                {colCards.length}
              </span>
            </div>

            {/* Drop zone */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: 8,
              padding: 6, borderRadius: 10, minHeight: 80,
              background: isDragOver ? 'var(--lm-accent-soft)' : 'var(--lm-canvas)',
              border: `1px solid ${isDragOver ? 'var(--lm-accent)' : 'var(--lm-line)'}`,
              transition: 'all 0.15s',
              overflowY: 'auto',
            }}>
              {colCards.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => { dragCard.current = card; setDragId(card.id); }}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  style={{
                    background: 'var(--lm-surface)',
                    border: '1px solid var(--lm-line)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex', flexDirection: 'column', gap: 6,
                    cursor: 'grab',
                    opacity: dragId === card.id ? 0.4 : 1,
                    transition: 'opacity 0.1s, box-shadow 0.1s',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--lm-ink)' }}>
                    {card.company}
                  </div>
                  <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-2)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {card.role}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    {card.scoreNum > 0
                      ? <ScoreChip score={Math.round(card.scoreNum * 20)} size="sm" variant={card.scoreNum >= 4 ? 'default' : 'muted'} />
                      : <span />
                    }
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10, color: 'var(--lm-ink-3)', letterSpacing: '0.5px' }}>
                        {card.date}
                      </span>
                      {card.reportId && (
                        <Link
                          href={`/reports/${card.reportId}`}
                          style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 11, color: 'var(--lm-accent)', textDecoration: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          ↗
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {colCards.length === 0 && (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-albert-sans)', fontSize: 12,
                  color: 'var(--lm-ink-3)', padding: '20px 0',
                }}>
                  drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
