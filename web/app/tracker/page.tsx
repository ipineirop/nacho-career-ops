import { getDb, evaluations, roles, pipelineStatus, userPreferences, users } from '@/lib/db';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/auth-bridge';
import { redirect } from 'next/navigation';
import { isFirstEvalVisit } from '@/lib/onboarding/isFirstVisit';
import { TrackerEmptyState } from '@/components/tracker/TrackerEmptyState';
import { TrackerShell, type AppRow } from '@/components/tracker/TrackerShell';
import { TrackerClient } from './TrackerClient';
import { resolveWayAForUser, type WayARenderable } from '@/lib/tracker/wayA';
import type { VerdictCode, Locale } from '@/lib/brief/i18n';

export const dynamic = 'force-dynamic';

async function loadApps(userId: string): Promise<AppRow[]> {
  // No-DB dev-preview mode → empty pipeline (so the teaching-moment empty
  // state renders). Real users always have a DB configured.
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_POSTGRES_URL) return [];
  try {
    const db = getDb();
    // Pull the latest evaluation per role (`supersededBy IS NULL`).
    // Multiple-eval per role lands in Phase 6 chapter substrate; for v1
    // the row's verdict is the latest one.
    const rows = await db
      .select()
      .from(evaluations)
      .where(and(eq(evaluations.userId, userId), isNull(evaluations.supersededBy)))
      .orderBy(desc(evaluations.evaluatedAt));

    return await Promise.all(
      rows.map(async (r): Promise<AppRow> => {
        const [roleData] = r.roleId
          ? await db.select().from(roles).where(eq(roles.id, r.roleId)).limit(1)
          : [undefined];

        const [statusData] = r.roleId
          ? await db
              .select()
              .from(pipelineStatus)
              .where(and(eq(pipelineStatus.userId, userId), eq(pipelineStatus.roleId, r.roleId)))
              .limit(1)
          : [undefined];

        return {
          id: r.id,
          roleId: r.roleId ?? null,
          company: roleData?.companyName ?? 'Unknown',
          role: roleData?.roleTitle ?? 'Unknown',
          status: statusData?.status ?? 'evaluating',
          // Verdict precedence: denormalized `verdict` column (set when the
          // editorial run completes), falling back to verdictPayload, then
          // null. Null gracefully omits the verdict pill — no placeholder.
          verdict: ((r.verdict as VerdictCode | null) ?? extractVerdictFromPayload(r.verdictPayload)) || null,
          scoreNum: r.overallScore ? Number(r.overallScore) / 20 : 0,
          date: r.evaluatedAt?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
          statusChangedAt: statusData?.statusChangedAt ?? null,
          reportId: r.displayId ?? null,
        };
      })
    );
  } catch (err) {
    console.error('Tracker load failed:', err);
    return [];
  }
}

function extractVerdictFromPayload(payload: unknown): VerdictCode | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = (payload as { verdict?: unknown }).verdict;
  if (typeof v !== 'string') return null;
  if (v === 'reply' || v === 'pursue' || v === 'watch' || v === 'skip') return v;
  return null;
}

async function loadUserContext(userId: string): Promise<{ locale: Locale; trackerActiveOnly: boolean }> {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_POSTGRES_URL) {
    return { locale: 'en', trackerActiveOnly: false };
  }
  try {
    const db = getDb();
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(and(eq(userPreferences.userId, userId), isNull(userPreferences.supersededAt)))
      .limit(1);
    const locale: Locale = (u?.locale ?? '').startsWith('en') ? 'en' : 'es';
    return { locale, trackerActiveOnly: prefs?.trackerActiveOnly ?? false };
  } catch {
    return { locale: 'en', trackerActiveOnly: false };
  }
}

export default async function TrackerPage() {
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  const [apps, firstVisit, ctx, wayATriggers] = await Promise.all([
    loadApps(authUser.id),
    isFirstEvalVisit(authUser.id),
    loadUserContext(authUser.id),
    // Phase 5 — pre-resolve Way-A triggers on the server. `logShownEvents`
    // is true here so one-shots are marked as surfaced on the first
    // render after a status transition.
    resolveWayAForUser(authUser.id, { logShownEvents: true }).catch(() => [] as WayARenderable[]),
  ]);
  const isEmpty = apps.length === 0;

  // Build a roleId → renderable map for the shell to consume per-row.
  const wayAByRole: Record<string, WayARenderable> = {};
  for (const r of wayATriggers) {
    if (r.trigger.roleId) wayAByRole[r.trigger.roleId] = r;
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--lm-bg)', color: 'var(--lm-ink)' }}>
      {/* The TrackerShell renders its own *Pipeline* heading + count. No
          duplicate editorial copy here — the "Every role, one log." line
          was design-handoff chrome, not a production header. */}
      <div className="max-w-6xl mx-auto px-8 py-9">
        {isEmpty ? (
          <TrackerEmptyState />
        ) : (
          <TrackerShell
            apps={apps}
            locale={ctx.locale}
            initialActiveOnly={ctx.trackerActiveOnly}
            wayAByRole={wayAByRole}
          />
        )}
      </div>

      {/* First-visit teaching moment — Tracker drives the coach mark + FAB pulse
          via the panel provider. No-op when firstVisit is false. */}
      <TrackerClient firstVisit={firstVisit} />
    </div>
  );
}
