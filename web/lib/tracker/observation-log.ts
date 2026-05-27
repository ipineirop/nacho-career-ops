/**
 * Tracker observation log — typed writers for the `user_events` event types
 * documented at `lib/db/schema.ts` near the userEvents declaration.
 *
 * Wiring doc §D requires status transitions to be persisted for the Pattern
 * log v1.5 surface, and §G's one-shot Way-A triggers (Phase 5) read these
 * rows to enforce single-fire semantics. All writers are best-effort: a
 * failed insert is logged and swallowed so it never breaks the user-facing
 * action that produced it.
 */

import { getDb, userEvents } from '@/lib/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { PipelineStatus } from '@/lib/api/validation';

export type TrackerEventType =
  | 'tracker.status_changed'
  | 'tracker.wayA_shown'
  | 'tracker.wayA_dismissed'
  | 'tracker.activeOnly_toggled';

interface StatusChangePayload {
  userId: string;
  roleId: string;
  fromStatus: string | null;
  toStatus: PipelineStatus;
  occurredAt?: Date;
  sessionId?: string;
}

/** Status transition observation. Writes a `tracker.status_changed` row to
 *  `user_events`. Skips silently on DB failure. */
export async function logTrackerStatusChange(payload: StatusChangePayload): Promise<void> {
  try {
    const db = getDb();
    await db.insert(userEvents).values({
      userId: payload.userId,
      eventType: 'tracker.status_changed',
      eventData: {
        roleId: payload.roleId,
        fromStatus: payload.fromStatus,
        toStatus: payload.toStatus,
        occurredAt: (payload.occurredAt ?? new Date()).toISOString(),
      },
      sessionId: payload.sessionId,
    });
  } catch (err) {
    // Don't fail the user's status update on a logging glitch.
    console.error('logTrackerStatusChange failed:', err);
  }
}

interface WayAEventPayload {
  userId: string;
  roleId: string;
  triggerCode: string;
  sessionId?: string;
}

/** Write a one-shot Way-A `shown` event for a {role, trigger} pair. Phase 5
 *  uses presence of this row to suppress re-firing for the same pair. */
export async function logWayAShown(payload: WayAEventPayload): Promise<void> {
  try {
    const db = getDb();
    await db.insert(userEvents).values({
      userId: payload.userId,
      eventType: 'tracker.wayA_shown',
      eventData: { roleId: payload.roleId, triggerCode: payload.triggerCode },
      sessionId: payload.sessionId,
    });
  } catch (err) {
    console.error('logWayAShown failed:', err);
  }
}

/** Dismissal is a user-driven explicit signal; presence of a row for a
 *  {role, trigger} pair suppresses re-firing across all rendering paths. */
export async function logWayADismissed(payload: WayAEventPayload): Promise<void> {
  try {
    const db = getDb();
    await db.insert(userEvents).values({
      userId: payload.userId,
      eventType: 'tracker.wayA_dismissed',
      eventData: { roleId: payload.roleId, triggerCode: payload.triggerCode },
      sessionId: payload.sessionId,
    });
  } catch (err) {
    console.error('logWayADismissed failed:', err);
  }
}

/** Telemetry-only: log the active-only toggle flip. Separate event type
 *  keeps it out of the row-action observation channel. */
export async function logActiveOnlyToggled(
  userId: string,
  active: boolean,
  sessionId?: string,
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(userEvents).values({
      userId,
      eventType: 'tracker.activeOnly_toggled',
      eventData: { active },
      sessionId,
    });
  } catch (err) {
    console.error('logActiveOnlyToggled failed:', err);
  }
}

/** Look up the set of `(roleId, triggerCode)` pairs for which a `shown` or
 *  `dismissed` event already exists. Phase 5 uses this to gate one-shot
 *  triggers. Returns a `Set<string>` keyed as `${roleId}:${triggerCode}`. */
export async function getSuppressedWayAPairs(userId: string): Promise<Set<string>> {
  const db = getDb();
  // jsonb arrow accessors are typed loosely in drizzle — fall back to sql tag.
  const rows = await db.execute<{ event_data: { roleId?: string; triggerCode?: string } | null }>(
    sql`SELECT event_data FROM user_events
        WHERE user_id = ${userId}
          AND event_type IN ('tracker.wayA_shown', 'tracker.wayA_dismissed')`,
  );
  // Drizzle's `execute` returns an iterable RowList; depending on driver
  // (postgres-js vs neon) it may expose `.rows` or be iterable directly.
  // Normalize.
  const iterable: Iterable<{ event_data: { roleId?: string; triggerCode?: string } | null }> =
    (rows as unknown as { rows?: typeof rows }).rows ?? (rows as unknown as Iterable<{ event_data: { roleId?: string; triggerCode?: string } | null }>);
  const suppressed = new Set<string>();
  for (const row of iterable) {
    const d = row.event_data ?? undefined;
    if (d?.roleId && d?.triggerCode) {
      suppressed.add(`${d.roleId}:${d.triggerCode}`);
    }
  }
  return suppressed;
}

/** Diagnostic helper used by Phase 7 verification: returns the N most recent
 *  status transition events for a user. */
export async function recentStatusTransitions(userId: string, limit = 10) {
  const db = getDb();
  return db
    .select()
    .from(userEvents)
    .where(and(eq(userEvents.userId, userId), eq(userEvents.eventType, 'tracker.status_changed')))
    .orderBy(desc(userEvents.occurredAt))
    .limit(limit);
}
