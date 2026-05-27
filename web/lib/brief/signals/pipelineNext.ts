/**
 * Pipeline · next signal — fires when a pipeline_status row has just
 * transitioned into 'interviewing' but no upcoming touchpoint is logged
 * yet. The body says "here's the next move at <Company>" with a specific
 * action.
 *
 * v1 trigger:
 *   - status === 'interviewing'
 *   - statusChangedAt within last 5 days
 *   - no interactions row in the future (we don't have a calendar table to
 *     check, so we settle for "no recent prep doc / no recent recruiter
 *     touch" by reusing lastTouchAt < statusChangedAt as a coarse proxy)
 *
 * This signal is the lightest of the five — it surfaces a fresh-context
 * nudge rather than a stale-state warning. One signal per qualifying role.
 */

import { getDb } from '@/lib/db';
import { pipelineStatus, roles } from '@/lib/db/schema';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { RawSignal } from './types';
import { buildKicker, KICKER_LABELS, KICKER_SUBJECT_YOUR } from '../i18n';
import { DEFAULT_SNOOZE_DAYS } from './types';

const FRESH_TRANSITION_DAYS = 5;

export async function computePipelineNextSignals(userId: string): Promise<RawSignal[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() - FRESH_TRANSITION_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: pipelineStatus.id,
      roleId: pipelineStatus.roleId,
      statusChangedAt: pipelineStatus.statusChangedAt,
      lastTouchAt: pipelineStatus.lastTouchAt,
      roleTitle: roles.roleTitle,
      companyName: roles.companyName,
    })
    .from(pipelineStatus)
    .innerJoin(roles, eq(pipelineStatus.roleId, roles.id))
    .where(
      and(
        eq(pipelineStatus.userId, userId),
        eq(pipelineStatus.status, 'interviewing'),
        gte(pipelineStatus.statusChangedAt, cutoff),
      ),
    )
    .orderBy(desc(pipelineStatus.statusChangedAt));

  const signals: RawSignal[] = [];

  for (const r of rows) {
    // Skip if the user has logged a touch AFTER the status change (they're
    // already moving on it).
    if (r.lastTouchAt && r.statusChangedAt) {
      const lastTouchTs = new Date(r.lastTouchAt as unknown as string).getTime();
      const changeTs = new Date(r.statusChangedAt as unknown as string).getTime();
      if (lastTouchTs > changeTs) continue;
    }

    const company = r.companyName || 'this role';
    const role = r.roleTitle || 'the role';

    const kicker = buildKicker({
      subject: KICKER_SUBJECT_YOUR,
      label: KICKER_LABELS.pipelineNext,
      context: company.toUpperCase(),
    });

    signals.push({
      type: 'pipeline.next',
      entityRef: `role:${r.roleId}`,
      kicker,
      groundingTokens: [company, role, 'interview', 'interviewing'],
      context: {
        role_id: r.roleId,
        company_name: company,
        role_title: role,
        status: 'interviewing',
        status_changed_iso: r.statusChangedAt
          ? new Date(r.statusChangedAt as unknown as string).toISOString()
          : null,
      },
      actions: {
        primary: { code: 'open_prep' },
        ghost: { code: 'snooze', durationDays: DEFAULT_SNOOZE_DAYS },
      },
    });
  }

  return signals;
}
