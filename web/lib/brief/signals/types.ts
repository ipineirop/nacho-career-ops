/**
 * Shared types for the Brief signal engine. Each signal module exports a
 * function that returns `RawSignal[]`, which the orchestrator (./index.ts)
 * merges, filters against signal_states (snooze/dismiss), and hands to the
 * LLM as `BriefSignalSeed[]` for body prose.
 *
 * A RawSignal carries everything the API + LLM need EXCEPT the body prose:
 * - `entityRef` is the natural occurrence key persisted to signal_states,
 *   so a snooze on yesterday's "pipeline.cold for Mercado Libre" suppresses
 *   the same occurrence today (handoff §6.2).
 * - `groundingTokens` enforce the §6.5 grounding rule both in the prompt
 *   ("must reference one of these") and in the linter ("body must contain
 *   at least one substring from this list").
 * - `kicker.en` / `kicker.es` are pre-localized because they don't go
 *   through the LLM — they're built from the i18n catalog + entity data.
 * - `actions` are pre-codified (i18n labels resolved at API boundary).
 */

export type SignalType =
  | 'freshness'
  | 'drift'
  | 'bar'
  | 'pipeline.cold'
  | 'pipeline.next';

export interface RawSignalActions {
  primary: { code: string };
  secondary?: { code: string };
  ghost?: { code: 'snooze' | 'dismiss' | 'skip' | 'keep'; durationDays?: number };
}

export interface RawSignal {
  type: SignalType;
  /** Natural occurrence key persisted to signal_states for snooze/dismiss.
   *  Examples: `field:comp_floor`, `company:Mercado Libre`, `role:<uuid>`. */
  entityRef: string;
  /** Bilingual kicker line, pre-built from the i18n catalog. Format from
   *  handoff §17.8: `*YOUR LABEL* · CONTEXT · TIMEFRAME`. */
  kicker: { en: string; es: string };
  /** Tokens the body MUST reference (grounding rule). Stringified counts
   *  ('3', '7d') and proper nouns ('Mercado Libre') both qualify. */
  groundingTokens: string[];
  /** Structured context for the LLM prompt. Open-ended per signal. */
  context: Record<string, unknown>;
  actions: RawSignalActions;
}

// Uniform 30-day default snooze across all signal types (user decision in
// the plan). When the user-configurable snooze durations land in a future
// version, this constant moves to a per-type lookup.
export const DEFAULT_SNOOZE_DAYS = 30;
