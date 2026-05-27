/**
 * Drift signal — fires when the user's stated preferences diverge from
 * their recent verdict behavior. Example: stated `targetSeniorityLevels =
 * ['head_of', 'vp']` but the last 30 days of evaluations all targeted IC
 * or manager-level roles.
 *
 * The signal names the specific mismatch (function vs. seniority vs. domain)
 * and counts the divergent evaluations. Both are concrete grounding tokens.
 *
 * v1 keeps the logic narrow: we look at `evaluations` from the last 30 days
 * joined to their `roles` and compare against `userPreferences`. Bar/drift
 * heuristics in the CLI are richer; this can grow later.
 */

import { getDb } from '@/lib/db';
import { evaluations, roles, userPreferences } from '@/lib/db/schema';
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import type { RawSignal } from './types';
import { buildKicker, KICKER_LABELS, KICKER_SUBJECT_YOUR } from '../i18n';
import { DEFAULT_SNOOZE_DAYS } from './types';

const LOOKBACK_DAYS = 30;
const DRIFT_MIN_EVAL_COUNT = 4; // need enough data to call drift

export async function computeDriftSignals(userId: string): Promise<RawSignal[]> {
  const db = getDb();

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(and(eq(userPreferences.userId, userId), isNull(userPreferences.supersededAt)))
    .orderBy(desc(userPreferences.createdAt))
    .limit(1);

  if (!prefs) return [];

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  // Recent evaluations joined to roles for seniority/function comparison.
  const recent = await db
    .select({
      seniority: roles.seniorityLevel,
      // roles.function is reserved-ish; use the actual column name
      func: roles.function,
    })
    .from(evaluations)
    .innerJoin(roles, eq(evaluations.roleId, roles.id))
    .where(
      and(
        eq(evaluations.userId, userId),
        gte(evaluations.createdAt, cutoff),
      ),
    );

  if (recent.length < DRIFT_MIN_EVAL_COUNT) return [];

  // Seniority drift: how many recent evals targeted a seniority OUTSIDE the
  // user's stated `targetSeniorityLevels`.
  const targetSeniority = prefs.targetSeniorityLevels ?? [];
  const offSeniority = targetSeniority.length
    ? recent.filter((r) => r.seniority && !targetSeniority.includes(r.seniority)).length
    : 0;

  const targetFunctions = prefs.targetFunctions ?? [];
  const offFunction = targetFunctions.length
    ? recent.filter((r) => r.func && !targetFunctions.includes(r.func)).length
    : 0;

  // Pick the bigger divergence — at most one drift signal per Brief.
  const seniorityRatio = offSeniority / recent.length;
  const functionRatio = offFunction / recent.length;

  let dimension: 'seniority' | 'function' | null = null;
  let mismatchCount = 0;
  if (seniorityRatio >= 0.5 && offSeniority >= functionRatio * recent.length) {
    dimension = 'seniority';
    mismatchCount = offSeniority;
  } else if (functionRatio >= 0.5) {
    dimension = 'function';
    mismatchCount = offFunction;
  }
  if (!dimension) return [];

  const kicker = buildKicker({
    subject: KICKER_SUBJECT_YOUR,
    label: KICKER_LABELS.drift,
    context: dimension === 'seniority' ? 'SENIORITY' : 'FUNCTION',
    timeframe: `${LOOKBACK_DAYS}D`,
  });

  return [
    {
      type: 'drift',
      entityRef: `field:${dimension}`,
      kicker,
      groundingTokens: [
        dimension,
        String(mismatchCount),
        `${LOOKBACK_DAYS}d`,
        ...(dimension === 'seniority' ? targetSeniority : targetFunctions),
      ],
      context: {
        dimension,
        mismatch_count: mismatchCount,
        total_recent: recent.length,
        stated_targets:
          dimension === 'seniority' ? targetSeniority : targetFunctions,
        observed_off_targets: recent
          .map((r) => (dimension === 'seniority' ? r.seniority : r.func))
          .filter((v) => v && !(dimension === 'seniority' ? targetSeniority : targetFunctions).includes(v as string)),
        lookback_days: LOOKBACK_DAYS,
      },
      actions: {
        primary: { code: 'update_preferences' },
        secondary: { code: 'tighten_model' },
        ghost: { code: 'dismiss' },
      },
    },
  ];
}
