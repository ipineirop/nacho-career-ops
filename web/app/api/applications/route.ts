import { NextRequest, NextResponse } from 'next/server';
import { getDb, evaluations, roles, pipelineStatus } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/auth-bridge';
import { PIPELINE_STATUS, type PipelineStatus } from '@/lib/api/validation';

const STATUS_VALUES = new Set<string>(Object.values(PIPELINE_STATUS));
function isCanonicalStatus(s: unknown): s is PipelineStatus {
  return typeof s === 'string' && STATUS_VALUES.has(s);
}

export async function GET() {
  const user = await getAuthUserId();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Get all evaluations for this user
  const evals = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.userId, user.id))
    .orderBy(evaluations.id);

  // Enrich with role and pipeline data
  const rows = await Promise.all(
    evals.map(async (e) => {
      const roleData = await db
        .select()
        .from(roles)
        .where(eq(roles.id, e.roleId!))
        .limit(1);

      const pipelineData = await db
        .select()
        .from(pipelineStatus)
        .where(and(eq(pipelineStatus.userId, user.id), eq(pipelineStatus.roleId, e.roleId!)))
        .limit(1);

      return {
        id: e.id,
        userEmail: user.email,
        date: e.evaluatedAt?.toISOString().split('T')[0],
        company: roleData[0]?.companyName,
        role: roleData[0]?.roleTitle,
        score: e.displayId,
        scoreNum: e.overallScore ? Number(e.overallScore) / 20 : 0,
        status: pipelineData[0]?.status ?? 'evaluating',
        hasPdf: !!e.fullReportMarkdown,
        reportId: e.displayId,
        notes: pipelineData[0]?.notesMarkdown,
        reportContent: e.fullReportMarkdown,
      };
    })
  );

  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUserId();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, status, notes } = body;

  if (!id || (status === undefined && notes === undefined)) {
    return NextResponse.json({ error: 'id and status or notes required' }, { status: 400 });
  }

  // Status, when present, must be in the DS §11 v3 taxonomy. The DB CHECK
  // constraint added in migration 0014 enforces this too; gate here so the
  // failure returns a 400 instead of bubbling up as a 500.
  if (status !== undefined && !isCanonicalStatus(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${[...STATUS_VALUES].join(', ')}` },
      { status: 400 },
    );
  }

  const db = getDb();

  // Get the evaluation to find the role
  const [eval_] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.id, id))
    .limit(1);

  if (!eval_) {
    return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
  }

  // Update pipeline_status with status and notes. When status changes, bump
  // statusChangedAt so Way-A (Phase 5) and the transition log (Phase 2) see
  // the correct delta.
  const now = new Date();
  const updates: Record<string, unknown> = { lastTouchAt: now };
  if (status !== undefined) {
    updates.status = status;
    updates.statusChangedAt = now;
  }
  if (notes !== undefined) updates.notesMarkdown = notes;

  // Read prior status before the update so we can emit a transition event.
  const [prior] = await db
    .select({ status: pipelineStatus.status })
    .from(pipelineStatus)
    .where(and(eq(pipelineStatus.userId, user.id), eq(pipelineStatus.roleId, eval_.roleId!)))
    .limit(1);

  const [updated] = await db
    .update(pipelineStatus)
    .set(updates)
    .where(
      and(
        eq(pipelineStatus.userId, user.id),
        eq(pipelineStatus.roleId, eval_.roleId!)
      )
    )
    .returning();

  // Emit the tracker.status_changed observation (Phase 2). Only when status
  // actually moves; notes-only updates skip the log.
  if (updated && status !== undefined && prior?.status !== status) {
    const { logTrackerStatusChange } = await import('@/lib/tracker/observation-log');
    await logTrackerStatusChange({
      userId: user.id,
      roleId: eval_.roleId!,
      fromStatus: prior?.status ?? null,
      toStatus: status as PipelineStatus,
      occurredAt: now,
    });
  }

  return NextResponse.json(updated || { id, status, notes });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUserId();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { company, role, ...rest } = body;

  const db = getDb();

  // Create or find a role
  let roleId: string;
  const existingRole = await db
    .select()
    .from(roles)
    .where(eq(roles.companyName, company))
    .limit(1);

  if (existingRole.length > 0) {
    roleId = existingRole[0].id;
  } else {
    // Create a new role
    const [newRole] = await db
      .insert(roles)
      .values({
        source: 'paste',
        sourceRef: `legacy-${Date.now()}`,
        companyName: company,
        roleTitle: role,
      })
      .returning();
    roleId = newRole.id;
  }

  // Create evaluation
  const [created] = await db
    .insert(evaluations)
    .values({
      userId: user.id,
      roleId,
      overallScore: rest.scoreNum ? rest.scoreNum * 20 : null,
      recommendation: rest.scoreNum >= 4 ? 'apply' : rest.scoreNum >= 3 ? 'hold' : 'pass',
      fullReportMarkdown: rest.reportContent,
      displayId: rest.reportId,
      ...rest,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
