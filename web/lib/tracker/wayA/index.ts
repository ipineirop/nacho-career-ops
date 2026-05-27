/**
 * Way-A orchestrator — compose the 9 trigger computations, suppress
 * already-shown/dismissed pairs (one-shots only), and resolve template
 * strings against the i18n catalog.
 *
 * Public entry point: `resolveWayAForUser(userId)`. Callers render the
 * resulting array inside Tracker rows; one row may have at most one
 * trigger surfaced (we pick the first match per role here).
 *
 * §G architecture: no LLM, no runtime linter — the template strings live
 * in the i18n catalog and pass a one-time voice review at PR time.
 */

import { computeWayATriggers } from './triggers';
import { getSuppressedWayAPairs, logWayAShown } from '../observation-log';
import { resolveWayATemplate } from '@/lib/brief/i18n';
import type { WayARenderable, WayATrigger } from './types';

export type { WayARenderable, WayATrigger } from './types';

interface ResolveOptions {
  /** When true, write a `tracker.wayA_shown` event for each one-shot
   *  trigger as it surfaces. Disable in read-only contexts (the Tracker
   *  page passes true; a debug/inspection path passes false). */
  logShownEvents?: boolean;
}

/** Resolve the user's active Way-A triggers, one per role, ready to render. */
export async function resolveWayAForUser(
  userId: string,
  opts: ResolveOptions = {},
): Promise<WayARenderable[]> {
  const all = await computeWayATriggers(userId);
  const suppressed = await getSuppressedWayAPairs(userId);

  // For one-shots, suppress any pair that already has a shown/dismissed
  // event. Threshold triggers fire while their condition holds and don't
  // consult the suppression set (dismissal applies separately, gated by
  // `tracker.wayA_dismissed` per-pair).
  const eligible = all.filter((t) => {
    const key = `${t.roleId}:${t.code}`;
    return !suppressed.has(key);
  });

  // Pick at most one trigger per role. Priority order: one-shots first
  // (they're event-driven and short-window), then thresholds by
  // recency-of-status — but since each role has at most one active status
  // anyway, we just take the first match in the deterministic order from
  // `computeWayATriggers` (which iterates by the standard for-of ordering).
  const perRole = new Map<string, WayATrigger>();
  // Prefer one-shots over thresholds for the same role.
  for (const t of eligible) {
    const existing = perRole.get(t.roleId);
    if (!existing) {
      perRole.set(t.roleId, t);
      continue;
    }
    if (existing.kind === 'threshold' && t.kind === 'oneShot') {
      perRole.set(t.roleId, t);
    }
  }

  const rendered: WayARenderable[] = [];
  for (const trigger of perRole.values()) {
    const r = resolveWayATemplate(trigger.templateKey, trigger.vars);
    rendered.push({ trigger, rendered: r });

    // Mark one-shots as shown so they don't re-fire on the next render.
    if (opts.logShownEvents && trigger.kind === 'oneShot') {
      await logWayAShown({
        userId,
        roleId: trigger.roleId,
        triggerCode: trigger.code,
      });
    }
  }
  return rendered;
}
