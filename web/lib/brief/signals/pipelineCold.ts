/**
 * Pipeline · cold signal — fires when a pipeline_status row has gone quiet
 * past its cadence threshold (no last_touch_at update in N days) and the
 * status is still active ('applied' or 'interviewing'). The body names the
 * company / contact and the days-quiet count — both grounding tokens.
 *
 * Cadence thresholds match the CLI followup-cadence.mjs heuristics:
 *   - applied:      stale after 7 days
 *   - interviewing: stale after 10 days
 *
 * One signal per stale role. Sorted by staleness desc so the most-quiet
 * threads bubble up; the assembler caps total visible signals at 5.
 */

import { getDb } from '@/lib/db';
import { pipelineStatus, roles } from '@/lib/db/schema';
import { and, eq, inArray, lt, or, isNull } from 'drizzle-orm';
import type { RawSignal } from './types';
import { buildKicker, KICKER_LABELS, KICKER_SUBJECT_YOUR } from '../i18n';
import { DEFAULT_SNOOZE_DAYS } from './types';

const CADENCE_DAYS: Record<string, number> = {
  applied: 7,
  interviewing: 10,
};

export async function computePipelineColdSignals(userId: string): Promise<RawSignal[]> {
  const db = getDb();

  const candidateStatuses = Object.keys(CADENCE_DAYS);
  // We pull the broader cutoff (longest cadence) and filter precisely below.
  const longestCadenceDays = Math.max(...Object.values(CADENCE_DAYS));
  const cutoff = new Date(Date.now() - longestCadenceDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: pipelineStatus.id,
      roleId: pipelineStatus.roleId,
      status: pipelineStatus.status,
      lastTouchAt: pipelineStatus.lastTouchAt,
      appliedAt: pipelineStatus.appliedAt,
      roleTitle: roles.roleTitle,
      companyName: roles.companyName,
    })
    .from(pipelineStatus)
    .innerJoin(roles, eq(pipelineStatus.roleId, roles.id))
    .where(
      and(
        eq(pipelineStatus.userId, userId),
        inArray(pipelineStatus.status, candidateStatuses),
        // last_touch_at OR applied_at older than the broadest cutoff
        or(
          lt(pipelineStatus.lastTouchAt, cutoff),
          and(isNull(pipelineStatus.lastTouchAt), lt(pipelineStatus.appliedAt, cutoff)),
        ),
      ),
    );

  const signals: RawSignal[] = [];

  for (const r of rows) {
    const cadenceDays = CADENCE_DAYS[r.status];
    if (cadenceDays === undefined) continue;

    const reference = (r.lastTouchAt ?? r.appliedAt) as Date | null;
    if (!reference) continue;

    const daysQuiet = Math.floor(
      (Date.now() - new Date(reference as unknown as string).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    if (daysQuiet < cadenceDays) continue;

    const company = r.companyName || 'this role';
    const role = r.roleTitle || 'the role';

    const kicker = buildKicker({
      subject: KICKER_SUBJECT_YOUR,
      label: KICKER_LABELS.pipelineCold,
      context: company.toUpperCase(),
      timeframe: `${daysQuiet}D`,
    });

    signals.push({
      type: 'pipeline.cold',
      entityRef: `role:${r.roleId}`,
      kicker,
      groundingTokens: [company, role, `${daysQuiet}d`, `${daysQuiet}`],
      context: {
        role_id: r.roleId,
        company_name: company,
        role_title: role,
        status: r.status,
        days_quiet: daysQuiet,
        last_touch_iso: new Date(reference as unknown as string).toISOString(),
      },
      actions: {
        primary: { code: 'draft_nudge' },
        secondary: { code: 'mark_closed' },
        ghost: { code: 'snooze', durationDays: DEFAULT_SNOOZE_DAYS },
      },
    });
  }

  // Stalest first.
  signals.sort(
    (a, b) =>
      (b.context.days_quiet as number) - (a.context.days_quiet as number),
  );

  return signals;
}
