/**
 * Bar signal — fires when the user is manually overriding the system's
 * verdict in a consistent direction. Example: every "watch" the engine
 * outputs is getting bumped to "pursue" by the user; the bar is too high.
 *
 * v1 status: STUB. The `evaluations` schema does not currently track manual
 * verdict overrides — the row carries the auto-derived verdict, not a
 * separate user-set verdict. Until override-tracking lands (planned
 * follow-up), this function returns []. The function exists so the
 * orchestrator can dispatch on the full signal-type union without special
 * cases, and so the plumbing is in place the day override data arrives.
 *
 * When implementing: read `evaluations` rows where the user explicitly
 * adjusted the verdict, group by direction (up = bar too high, down = bar
 * too low), require ≥3 same-direction overrides in the lookback window, and
 * emit a signal whose grounding tokens are the override count and the
 * affected verdict word.
 */

import type { RawSignal } from './types';

export async function computeBarSignals(_userId: string): Promise<RawSignal[]> {
  return [];
}
