/**
 * Signal orchestrator: runs all five signal modules in parallel, filters
 * the union against signal_states (snooze + dismiss), and returns the
 * final RawSignal[] the assembler hands to the LLM for body prose.
 *
 * Ordering on the final list: the assembler caps visible signals at 5 and
 * folds the rest into `collapsed`. Order here is "most-actionable first":
 *   1. pipeline.next   (fresh transition, prep needed now)
 *   2. pipeline.cold   (stale thread, drift toward closed)
 *   3. drift           (your preferences mismatch your behavior)
 *   4. freshness       (your data is going stale)
 *   5. bar             (the system's calibration needs your eye)
 *
 * Grounding rule (handoff §6.5) is enforced at the per-module layer: a
 * module only emits a RawSignal if its body can be grounded. This module
 * does a final safety check (groundingTokens must be non-empty) and drops
 * anything that slipped through.
 */

import { getDb } from '@/lib/db';
import { signalStates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RawSignal, SignalType } from './types';
import { computeFreshnessSignals } from './freshness';
import { computeDriftSignals } from './drift';
import { computeBarSignals } from './bar';
import { computePipelineColdSignals } from './pipelineCold';
import { computePipelineNextSignals } from './pipelineNext';

const TYPE_ORDER: SignalType[] = [
  'pipeline.next',
  'pipeline.cold',
  'drift',
  'freshness',
  'bar',
];

export interface ComputedSignals {
  /** Signals that survived grounding + snooze/dismiss filtering, in
   *  TYPE_ORDER then per-module order. The assembler slices visible[0..5]. */
  signals: RawSignal[];
}

export async function computeSignals(userId: string): Promise<ComputedSignals> {
  const [freshness, drift, bar, cold, next] = await Promise.all([
    computeFreshnessSignals(userId),
    computeDriftSignals(userId),
    computeBarSignals(userId),
    computePipelineColdSignals(userId),
    computePipelineNextSignals(userId),
  ]);

  // Filter each signal occurrence against signal_states. A snoozed
  // occurrence is hidden until snoozed_until passes; a dismissed
  // occurrence is hidden permanently.
  const db = getDb();
  const states = await db
    .select()
    .from(signalStates)
    .where(eq(signalStates.userId, userId));

  const now = Date.now();
  const stateByKey = new Map<string, { snoozedUntil: Date | null; dismissedAt: Date | null }>();
  for (const s of states) {
    stateByKey.set(`${s.signalType}|${s.entityRef}`, {
      snoozedUntil: s.snoozedUntil as Date | null,
      dismissedAt: s.dismissedAt as Date | null,
    });
  }

  function notSuppressed(sig: RawSignal): boolean {
    const st = stateByKey.get(`${sig.type}|${sig.entityRef}`);
    if (!st) return true;
    if (st.dismissedAt) return false;
    if (st.snoozedUntil && new Date(st.snoozedUntil as unknown as string).getTime() > now) return false;
    return true;
  }

  const byType: Record<SignalType, RawSignal[]> = {
    'pipeline.next': next,
    'pipeline.cold': cold,
    drift,
    freshness,
    bar,
  };

  const ordered: RawSignal[] = [];
  for (const t of TYPE_ORDER) {
    for (const sig of byType[t]) {
      if (sig.groundingTokens.length === 0) continue; // belt + suspenders for §6.5
      if (!notSuppressed(sig)) continue;
      ordered.push(sig);
    }
  }

  return { signals: ordered };
}

export type { RawSignal, SignalType };
export { DEFAULT_SNOOZE_DAYS } from './types';
