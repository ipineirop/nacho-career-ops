/**
 * Way-A trigger computations.
 *
 * Each trigger is a pure function over the user's pipeline_status table —
 * deterministic, no LLM, no external integration. The §G specification
 * locks the 9 v1 conditions; the implementation here mirrors them exactly.
 *
 * Threshold triggers fire while their condition holds (e.g.
 * `applied + 14d quiet but not yet 30d`). One-shot triggers fire once per
 * `{roleId, triggerCode}` pair — Phase 2's observation log gates them via
 * the `tracker.wayA_shown` event.
 */

import { getDb } from '@/lib/db';
import { pipelineStatus, roles } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import type { WayATrigger } from './types';

const DAY = 24 * 60 * 60 * 1000;

interface Row {
  roleId: string;
  status: string;
  statusChangedAt: Date | null;
  company: string;
}

/** Read every pipeline row plus a denormalized company name. The Way-A
 *  evaluator does its own date arithmetic per-row; the DB layer just
 *  returns the substrate. */
async function loadRows(userId: string): Promise<Row[]> {
  const db = getDb();
  const records = await db
    .select({
      roleId: pipelineStatus.roleId,
      status: pipelineStatus.status,
      statusChangedAt: pipelineStatus.statusChangedAt,
      company: roles.companyName,
    })
    .from(pipelineStatus)
    .innerJoin(roles, eq(pipelineStatus.roleId, roles.id))
    .where(eq(pipelineStatus.userId, userId));
  return records.map((r) => ({
    roleId: r.roleId,
    status: r.status,
    statusChangedAt: r.statusChangedAt as Date | null,
    company: r.company ?? 'this role',
  }));
}

function daysSince(d: Date | null): number {
  if (!d) return Infinity;
  return Math.floor((Date.now() - new Date(d).getTime()) / DAY);
}

/** Evaluate all 9 trigger conditions against the user's pipeline. Returns
 *  the flat list of fired triggers, unfiltered for one-shot suppression
 *  (the orchestrator in `index.ts` applies the suppression). */
export async function computeWayATriggers(userId: string): Promise<WayATrigger[]> {
  const rows = await loadRows(userId);
  const triggers: WayATrigger[] = [];

  for (const r of rows) {
    const days = daysSince(r.statusChangedAt);
    const vars = { company: r.company };

    // applied → 14d quiet (14d ≤ days < 30d)
    if (r.status === 'applied' && days >= 14 && days < 30) {
      triggers.push({
        code: 'applied_14d',
        kind: 'threshold',
        templateKey: 'followUp',
        roleId: r.roleId,
        vars,
      });
    }
    // applied → 30d quiet
    if (r.status === 'applied' && days >= 30) {
      triggers.push({
        code: 'applied_30d',
        kind: 'threshold',
        templateKey: 'markGhosted',
        roleId: r.roleId,
        vars,
        primaryActionStatus: 'ghosted',
      });
    }

    // interviewing → 21d quiet (21d ≤ days < 45d)
    if (r.status === 'interviewing' && days >= 21 && days < 45) {
      triggers.push({
        code: 'interviewing_21d',
        kind: 'threshold',
        templateKey: 'statusCheck',
        roleId: r.roleId,
        vars,
      });
    }
    // interviewing → 45d quiet
    if (r.status === 'interviewing' && days >= 45) {
      triggers.push({
        code: 'interviewing_45d',
        kind: 'threshold',
        templateKey: 'didThisGoQuiet',
        roleId: r.roleId,
        vars,
        primaryActionStatus: 'ghosted',
      });
    }

    // offer_pending → 5d (5d ≤ days < 14d)
    if (r.status === 'offer_pending' && days >= 5 && days < 14) {
      triggers.push({
        code: 'offer_pending_5d',
        kind: 'threshold',
        templateKey: 'captureOffer',
        roleId: r.roleId,
        vars,
      });
    }
    // offer_pending → 14d
    if (r.status === 'offer_pending' && days >= 14) {
      triggers.push({
        code: 'offer_pending_14d',
        kind: 'threshold',
        templateKey: 'offerAging',
        roleId: r.roleId,
        vars,
      });
    }

    // evaluating → 60d no movement
    if (r.status === 'evaluating' && days >= 60) {
      triggers.push({
        code: 'evaluating_60d',
        kind: 'threshold',
        templateKey: 'stillConsidering',
        roleId: r.roleId,
        vars,
        primaryActionStatus: 'passed',
      });
    }

    // One-shots fire only within the 24h window immediately after the
    // transition. The orchestrator gates on `tracker.wayA_shown` for
    // single-fire semantics.
    if (r.status === 'interviewing' && days < 1) {
      triggers.push({
        code: 'interviewing_freshTransition',
        kind: 'oneShot',
        templateKey: 'spinUpPrep',
        roleId: r.roleId,
        vars,
      });
    }
    if (r.status === 'offer_pending' && days < 1) {
      triggers.push({
        code: 'offer_pending_freshTransition',
        kind: 'oneShot',
        templateKey: 'captureOfferDetails',
        roleId: r.roleId,
        vars,
      });
    }
  }

  return triggers;
}
