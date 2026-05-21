import { getDb, evaluations, roles, pipelineStatus } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/auth-bridge';
import { redirect } from 'next/navigation';
import { AvatarCo } from '@/components/ui/avatar-co';
import { ScoreChip } from '@/components/ui/score-chip';
import { PipelineFirstRun } from '@/components/pipeline/PipelineFirstRun';

export const dynamic = 'force-dynamic';

export default async function DiscoverPage() {
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  const db = getDb();

  // Get all evaluations for this user
  const userEvals = await db
    .select({ roleId: evaluations.roleId })
    .from(evaluations)
    .where(eq(evaluations.userId, authUser.id));

  // Get roles without evaluations (pending)
  const allRoles = await db.select().from(roles);
  const evalRoleIds = new Set(userEvals.map((e) => e.roleId));
  const pendingRoles = allRoles.filter((r) => !evalRoleIds.has(r.id));

  // Enrich pending roles with pipeline status
  const dbJobs = await Promise.all(
    pendingRoles.map(async (role) => {
      const pipeline = await db
        .select()
        .from(pipelineStatus)
        .where(eq(pipelineStatus.roleId, role.id))
        .limit(1);

      return {
        id: role.id,
        company: role.companyName,
        role: role.roleTitle,
        portal: role.portal,
        location: role.location,
        url: role.sourceRef,
        firstSeen: role.scrapedAt?.toISOString().split('T')[0],
        status: pipeline[0]?.status ?? 'evaluating',
      };
    })
  );

  const today = new Date();
  const issueNum = Math.floor((today.getTime() - new Date('2024-01-01').getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="flex h-full overflow-hidden">

      {/* Main content */}
      <div style={{ flex: 1, padding: '20px 20px', overflowY: 'auto', background: 'var(--lm-bg)', maxWidth: '100%', minWidth: 0 }}>

        {/* Header */}
        <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 8 }}>
          ISSUE №{issueNum} · {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()} · CDMX
        </div>
        <h1 className="font-editorial" style={{ fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1, color: 'var(--lm-ink)', margin: '0 0 20px' }}>
          Today&apos;s <em>brief</em>.
        </h1>

        {/* Provenance card */}
        <div style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
              HOW THIS BRIEF WAS BUILT
            </span>
            <span style={{ padding: '3px 11px', borderRadius: 999, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500 }}>
              ✓ fresh
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)' }}>
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 700, color: 'var(--lm-ink)' }}>{dbJobs.length}</span> leads pending evaluation · scanned from your target companies
          </div>
        </div>

        {/* Editor's note */}
        <div style={{ background: 'var(--lm-accent-soft)', borderRadius: 10, padding: '18px 22px', marginBottom: 24, position: 'relative' }}>
          <span style={{ position: 'absolute', top: -10, left: 18, fontFamily: 'var(--font-geist-mono)', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--lm-accent)', background: 'var(--lm-bg)', padding: '2px 10px', borderRadius: 999 }}>
            Editor&apos;s note
          </span>
          <p className="font-editorial" style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--lm-ink)', margin: 0 }}>
            {dbJobs.length > 0
              ? `${dbJobs.length} lead${dbJobs.length > 1 ? 's' : ''} waiting to be evaluated. Evaluate each one to score it against your profile.`
              : 'Pipeline is empty. Run a scan or evaluate leads from the Evaluate page.'}
          </p>
        </div>

        {/* Job cards */}
        {dbJobs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {dbJobs.map((job, i) => {
              const initials = (job.company ?? '?').slice(0, 2).toUpperCase();
              return (
                <div key={job.id} style={{ background: 'var(--lm-surface)', border: '1px solid var(--lm-line)', borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 10.5, color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
                    №{i + 1} · {(job.portal ?? '').toUpperCase() || 'PORTAL'} · {job.firstSeen ?? 'RECENT'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <AvatarCo initials={initials} size="lg" />
                    <div style={{ flex: 1 }}>
                      <div className="font-editorial" style={{ fontSize: 24, lineHeight: 1.1, color: 'var(--lm-ink)' }}>
                        {job.company ?? 'Company'} · <em>{job.role ?? 'Role'}</em>
                      </div>
                      <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)', marginTop: 4 }}>
                        {job.location ? `📍 ${job.location} · ` : ''}{job.url}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`/evaluate?url=${encodeURIComponent(job.url ?? '')}&jobId=${job.id}`} style={{ padding: '7px 16px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
                      ✦ Evaluate
                    </a>
                    <a href={job.url ?? '#'} target="_blank" rel="noreferrer" style={{ padding: '7px 16px', borderRadius: 999, border: '1px solid var(--lm-line)', background: 'var(--lm-surface)', fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink)', textDecoration: 'none' }}>
                      View posting ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <PipelineFirstRun />
        )}
      </div>

      {/* Companion chat — hidden on mobile */}
      <div className="hidden lg:flex" style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--lm-line)', background: 'var(--lm-canvas)', padding: 16, flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-albert-sans)' }}>✦</div>
          <div>
            <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 15, color: 'var(--lm-ink)' }}>Ask the editor</div>
            <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-ink-3)' }}>about today&apos;s brief</div>
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--lm-accent-soft)', fontFamily: 'var(--font-albert-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--lm-ink)' }}>
          {dbJobs.length} leads waiting. Evaluate each one to score it — skip Evaluate → it&apos;ll pre-fill the job description from the posting.
        </div>
        <div style={{ flex: 1 }} />
        <a href="/evaluate" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 16px', borderRadius: 999, background: 'var(--lm-accent)', color: 'var(--lm-accent-on)', fontFamily: 'var(--font-albert-sans)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          <span style={{ fontSize: 11 }}>✦</span> Evaluate a lead
        </a>
      </div>
    </div>
  );
}
