/**
 * Skeleton — only visible on a user's very first Brief view (no cached
 * payload exists yet). After that, every subsequent view hits the cache
 * and returns instantly.
 *
 * Per handoff §6.4 the skeleton mimics shape, not shimmer. No animation in
 * v1. The masthead renders real text immediately — it has no LLM dependency
 * (issue number + date + city are all derivable server-side).
 */

import type { BriefMasthead } from '@/lib/brief/types';
import { HeaderBlock } from './HeaderBlock';
import type { Locale } from './text';

export function Skeleton({
  masthead,
  locale,
}: {
  masthead: BriefMasthead;
  locale: Locale;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      <HeaderBlock masthead={masthead} locale={locale} />
      {/* Editor's note placeholder — match the eventual 22px Fraunces 1.32
          line-height paragraph. Two lines feels right for a 1–3 sentence
          editorial; the actual paragraph may collapse to one or expand to
          three. */}
      <div className="mb-s6">
        <SkelLine width="80%" />
        <SkelLine width="58%" mt="s2" />
      </div>
      {/* Two signal placeholders — shape only (kicker, body, action row). */}
      <SkelSignalCard />
      <SkelSignalCard />
      {/* Pipeline summary placeholder — single line above-divider. */}
      <div className="mt-s7 pt-s5 border-t border-line">
        <SkelLine width="65%" />
      </div>
    </div>
  );
}

function SkelLine({ width, mt }: { width: string; mt?: string }) {
  return (
    <div
      style={{ width, height: '1em', marginTop: mt ? `var(--spacing-${mt})` : undefined }}
      className="bg-line-2 rounded-card"
    />
  );
}

function SkelSignalCard() {
  return (
    <div className="bg-surface border border-line rounded-card p-s5 mb-s4">
      <SkelLine width="40%" />
      <div className="mt-s3">
        <SkelLine width="92%" />
        <SkelLine width="78%" mt="s2" />
      </div>
      <div className="flex gap-s2 mt-s4">
        <div className="h-[36px] w-[140px] bg-line-2 rounded-pill" />
        <div className="h-[36px] w-[100px] bg-canvas rounded-pill" />
      </div>
    </div>
  );
}
