'use client';

/**
 * BriefView — client orchestrator for /brief.
 *
 * Three states feed the render:
 *   1. `initialPayload === null` (no row in brief_cache at SSR time): the
 *      view bootstraps by fetching /api/brief, which on miss returns
 *      `{ pending: true, masthead }` and kicks off background generation.
 *      We render the skeleton and poll until we see `pending: false`.
 *   2. `initialPayload.pending === true`: server returned a pending shape.
 *      Same path as #1.
 *   3. `initialPayload.pending === false`: live payload, render straight in.
 *
 * Locale: passed from the server. There is no toggle in v1; switching
 * locale requires updating users.locale via /settings and reloading.
 *
 * Render order (handoff §2):
 *   Masthead → Editor's note → Pick (only if non-null) → Signal stack
 *   (only if visible.length > 0) → Pipeline summary
 *
 * Empty Brief = Masthead + Editor's note + Pipeline summary only.
 */

import { useEffect, useRef, useState } from 'react';
import type { BriefApiResponse, BriefPayload } from '@/lib/brief/types';
import { HeaderBlock } from './components/HeaderBlock';
import { EditorsNote } from './components/EditorsNote';
import { PickCard } from './components/PickCard';
import { SignalStack } from './components/SignalStack';
import { PipelineSummary } from './components/PipelineSummary';
import { Skeleton } from './components/Skeleton';
import { useLocale } from '@/components/locale/LocaleProvider';
import type { Locale } from './components/text';

interface BriefViewProps {
  initialPayload: BriefApiResponse | null;
  /** Server-derived locale, used by the LocaleProvider in layout.tsx to
   *  seed the context. Kept here for the type and for documentation; the
   *  view itself reads the live value from useLocale() so the global
   *  toggle re-renders this surface instantly. */
  initialLocale: Locale;
  isoDate: string;
}

const POLL_INTERVAL_MS = 1500;
const POLL_CEILING_MS = 30_000;

export function BriefView({ initialPayload, isoDate }: BriefViewProps) {
  const [payload, setPayload] = useState<BriefApiResponse | null>(initialPayload);
  const { locale } = useLocale();
  const startedAt = useRef<number | null>(null);

  // Bootstrap: if we have no payload, or the payload is pending, fetch +
  // poll. If the server kicked off generation via after(), the cache row
  // should land within a few seconds.
  useEffect(() => {
    let cancelled = false;
    const needsFetch = payload === null || (payload && (payload as { pending?: boolean }).pending === true);
    if (!needsFetch) return;

    if (startedAt.current === null) startedAt.current = Date.now();

    async function pollOnce(): Promise<void> {
      try {
        const res = await fetch(`/api/brief?date=${encodeURIComponent(isoDate)}`, {
          method: 'GET',
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error(`GET /api/brief returned ${res.status}`);
        const next = (await res.json()) as BriefApiResponse;
        if (cancelled) return;
        setPayload(next);
        if (next.pending === true) schedule();
      } catch (err) {
        console.error('BriefView poll failed', err);
        if (!cancelled) schedule();
      }
    }

    function schedule() {
      if (cancelled) return;
      if (startedAt.current !== null && Date.now() - startedAt.current > POLL_CEILING_MS) {
        // Give up. The user can reload to retry. Leave skeleton up rather
        // than crashing the surface.
        return;
      }
      setTimeout(pollOnce, POLL_INTERVAL_MS);
    }

    void pollOnce();
    return () => {
      cancelled = true;
    };
  }, [payload, isoDate]);

  // No payload yet (initial null + first fetch in flight) — render a thin
  // skeleton without a masthead. This is rare in practice because the
  // server pre-fetches the cache; we only hit this branch if the page
  // mounts without any cached row at all.
  if (payload === null) {
    return (
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 32px 120px' }}>
        <div className="font-mono text-[11px] uppercase tracking-[0.4px] text-ink-3 mb-s5">
          loading…
        </div>
      </div>
    );
  }

  // Pending: server has no cached row, generation is running. Render the
  // skeleton with the real masthead on top.
  if (payload.pending === true) {
    return (
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 32px 120px' }}>
        <Skeleton masthead={payload.masthead} locale={locale} />
      </div>
    );
  }

  // Live payload — render the full Brief.
  return <BriefBody payload={payload} locale={locale} />;
}

function BriefBody({ payload, locale }: { payload: BriefPayload; locale: Locale }) {
  return (
    // Reading column matches the source: max-width 760px, 56/32/120 padding.
    <div
      style={{
        maxWidth: '760px',
        margin: '0 auto',
        padding: '56px 32px 120px',
        position: 'relative',
      }}
    >
      <HeaderBlock masthead={payload.masthead} locale={locale} />
      <EditorsNote note={payload.editorsNote} locale={locale} />
      {payload.pick && <PickCard pick={payload.pick} locale={locale} />}
      {/* SignalStack owns its own empty state ("all quiet today") so the
          Brief never has a visual gap between the editor's note and the
          pipeline summary. */}
      <SignalStack
        visible={payload.signals.visible}
        collapsed={payload.signals.collapsed}
        locale={locale}
      />
      <PipelineSummary summary={payload.pipelineSummary} locale={locale} />
    </div>
  );
}
