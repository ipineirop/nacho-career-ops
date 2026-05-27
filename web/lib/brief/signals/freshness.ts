/**
 * Freshness signal — fires when user-data the system relies on is getting
 * stale. The Brief's voice says: "I haven't heard from you on X in a while;
 * here's what I'll do if you don't update it."
 *
 * v1 sources:
 *   - Comp floor    → field:comp_floor (userPreferences.floorCompUsd updated_at)
 *   - Archetype/targeting prefs → field:archetypes (userPreferences.createdAt)
 *
 * Each field has a staleness threshold. When exceeded, emit a signal with
 * the field name and "Xmo" as grounding tokens. Only the freshest stale
 * field is surfaced per Brief (we don't want to nag with three at once).
 */

import { getDb } from '@/lib/db';
import { userPreferences } from '@/lib/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { RawSignal } from './types';
import { buildKicker, KICKER_LABELS, KICKER_SUBJECT_YOUR, snoozeLabelWithDuration } from '../i18n';
import { DEFAULT_SNOOZE_DAYS } from './types';

const STALE_THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000; // 6 months

interface FreshnessCandidate {
  field: 'comp_floor' | 'archetypes';
  fieldNameEn: string;
  fieldNameEs: string;
  lastUpdated: Date;
}

function monthsSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / (30 * 24 * 60 * 60 * 1000));
}

export async function computeFreshnessSignals(userId: string): Promise<RawSignal[]> {
  const db = getDb();

  // Current (non-superseded) preferences row carries comp + archetype data.
  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(and(eq(userPreferences.userId, userId), isNull(userPreferences.supersededAt)))
    .orderBy(desc(userPreferences.createdAt))
    .limit(1);

  if (!prefs) return [];

  const candidates: FreshnessCandidate[] = [];

  // Comp floor: stale if the current preferences row itself is older than
  // the threshold AND has a floor set. Without explicit per-field timestamps
  // we use the row's createdAt as the proxy.
  if (prefs.floorCompUsd && prefs.createdAt) {
    const updatedAt = new Date(prefs.createdAt as unknown as string);
    if (Date.now() - updatedAt.getTime() > STALE_THRESHOLD_MS) {
      candidates.push({
        field: 'comp_floor',
        fieldNameEn: 'comp floor',
        fieldNameEs: 'piso salarial',
        lastUpdated: updatedAt,
      });
    }
  }

  // Archetypes / targeting: use the same row timestamp as proxy. Only flag
  // if the user has targeting set (otherwise there's nothing to refresh).
  const hasTargeting =
    (prefs.targetSeniorityLevels?.length ?? 0) > 0 ||
    (prefs.targetFunctions?.length ?? 0) > 0;
  if (hasTargeting && prefs.createdAt) {
    const updatedAt = new Date(prefs.createdAt as unknown as string);
    if (Date.now() - updatedAt.getTime() > STALE_THRESHOLD_MS) {
      candidates.push({
        field: 'archetypes',
        fieldNameEn: 'archetypes',
        fieldNameEs: 'arquetipos',
        lastUpdated: updatedAt,
      });
    }
  }

  if (candidates.length === 0) return [];

  // Surface only the stalest field per Brief.
  candidates.sort((a, b) => a.lastUpdated.getTime() - b.lastUpdated.getTime());
  const top = candidates[0];
  const months = monthsSince(top.lastUpdated);
  const timeframe = `${months}mo`;

  const kicker = buildKicker({
    subject: KICKER_SUBJECT_YOUR,
    label: KICKER_LABELS.freshness,
    context: top.field === 'comp_floor' ? 'COMP FLOOR' : 'ARCHETYPES',
    timeframe,
  });

  return [
    {
      type: 'freshness',
      entityRef: `field:${top.field}`,
      kicker,
      groundingTokens: [top.fieldNameEn, top.fieldNameEs, timeframe, `${months}`],
      context: {
        field: top.field,
        months_stale: months,
        last_updated_iso: top.lastUpdated.toISOString(),
        floor_usd: top.field === 'comp_floor' ? Number(prefs.floorCompUsd) : null,
      },
      actions: {
        primary: { code: top.field === 'comp_floor' ? 'update_preferences' : 'recalibrate_set' },
        ghost: { code: 'snooze', durationDays: DEFAULT_SNOOZE_DAYS },
      },
    },
  ];
}

// Surface a stable snooze label using i18n's snoozeLabelWithDuration so the
// API response can include a localized "Snooze 30d" / "Posponer 30d" string.
// (Used by the assembler, not by the signal module directly.)
export const _snoozeLabel = snoozeLabelWithDuration;
