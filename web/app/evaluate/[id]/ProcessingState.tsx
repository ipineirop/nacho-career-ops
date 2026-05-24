'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ROWS: { label: string; value: string }[] = [
  { label: 'Company',      value: 'Reading…' },
  { label: 'Role',         value: 'Reading…' },
  { label: 'Level',        value: 'Reading…' },
  { label: 'Compensation', value: 'Reading…' },
  { label: 'Location',     value: 'Reading…' },
  { label: 'Source',       value: 'Reading…' },
];

const REVEAL_DELAY_MS = 1200;
const POLL_INTERVAL_MS = 4000;

/**
 * Processing-state placeholder for /evaluate/[id]. Six rows reveal sequentially
 * (no spinner). While they animate in, the page polls the row's status; when
 * it flips to 'complete' (or 'failed'), router.refresh() re-renders the server
 * component and the editorial verdict takes over.
 *
 * TODO(infra): replace placeholder values with live extraction streamed into
 * the row. Subscribe to row updates and reveal each row as the data arrives,
 * not on a fixed timer.
 */
export function ProcessingState({ evaluationId }: { evaluationId: string }) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(0);

  // Sequentially reveal the rows.
  useEffect(() => {
    if (revealed >= ROWS.length) return;
    const t = setTimeout(() => setRevealed((n) => n + 1), REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, [revealed]);

  // Poll the row's status; refresh the route when it leaves 'processing'.
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/evaluations/${evaluationId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.evaluation?.status && data.evaluation.status !== 'processing') {
          router.refresh();
        }
      } catch { /* keep polling */ }
    }
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    void tick();
    return () => { cancelled = true; clearInterval(handle); };
  }, [evaluationId, router]);

  return (
    <div className="max-w-[720px] px-s5 py-s6 flex flex-col gap-s4">
      <span className="font-mono text-[11px] uppercase tracking-[0.4px] text-ink-3">Evaluate</span>
      <h1 className="font-serif text-[28px] leading-[1.12] text-ink m-0">
        Reading the lead<em className="italic">.</em>
      </h1>
      <div className="mt-s4 flex flex-col gap-s4">
        {ROWS.map((row, i) => {
          const shown = i < revealed;
          return (
            <div
              key={row.label}
              className={[
                'flex flex-col gap-s1 transition-all',
                shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[8px]',
              ].join(' ')}
              style={{ transitionDuration: '400ms' }}
              aria-hidden={!shown}
            >
              <span className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-3">{row.label}</span>
              <span className="font-body text-[14px] text-ink">{row.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
