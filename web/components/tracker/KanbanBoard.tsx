'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ScoreChip } from '@/components/ui/score-chip';
import { useLocale } from '@/components/locale/LocaleProvider';

interface AppCard {
  id: string;
  /** The role the evaluation/pipeline row points at. Required for status
   *  PATCH; without it we can't update the canonical pipeline_status row. */
  roleId: string | null;
  company: string;
  role: string;
  status: string;
  scoreNum: number;
  date: string;
  reportId: string | null;
}

// Each of the nine DS §11 v3 statuses points to exactly one column.
// Dragging a card into a column writes `targetStatus` as the new value, so
// the Offer column rendezvous'es offer_pending + offer_accepted under a
// single visual but the row pill inside each card disambiguates which.
const COLUMNS: { id: string; label: { en: string; es: string }; statuses: string[]; targetStatus: string }[] = [
  { id: 'leads',     label: { en: 'Leads',     es: 'Leads' },     statuses: ['evaluating'],                              targetStatus: 'evaluating' },
  { id: 'applied',   label: { en: 'Applied',   es: 'Aplicadas' }, statuses: ['applied'],                                 targetStatus: 'applied' },
  { id: 'interview', label: { en: 'Interview', es: 'Entrevista' }, statuses: ['interviewing'],                          targetStatus: 'interviewing' },
  { id: 'offer',     label: { en: 'Offer',     es: 'Oferta' },    statuses: ['offer_pending', 'offer_accepted'],         targetStatus: 'offer_pending' },
  { id: 'closed',    label: { en: 'Closed',    es: 'Cerradas' },  statuses: ['rejected', 'withdrew', 'passed', 'ghosted'], targetStatus: 'passed' },
];

function colFor(status: string): string {
  for (const col of COLUMNS) {
    if (col.statuses.includes(status)) return col.id;
  }
  return 'leads';
}

export function KanbanBoard({ applications }: { applications: AppCard[] }) {
  const { locale } = useLocale();
  const [cards, setCards] = useState(applications);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const dragCard = useRef<AppCard | null>(null);

  async function moveCard(cardId: string, targetColId: string) {
    const col = COLUMNS.find((c) => c.id === targetColId);
    if (!col) return;
    const card = cards.find((c) => c.id === cardId);
    // Cards without a roleId can't be updated (the canonical pipeline_status
    // row is keyed by (userId, roleId)). Skip with a no-op rather than
    // optimistically moving and silently dropping the change.
    if (!card?.roleId) return;
    const newStatus = col.targetStatus;
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, status: newStatus } : c));
    // `/api/pipeline/status` upserts (matches the same path the list-view
    // status dropdown uses). The previous target `/api/applications` only
    // UPDATEd existing rows — cards in Leads (no pipeline_status row yet)
    // silently no-op'd, which is why moves didn't persist.
    await fetch('/api/pipeline/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: card.roleId, status: newStatus }),
    }).catch(() => { /* swallow; UI already moved optimistically */ });
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
                {col.label[locale]}
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
