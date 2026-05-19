import { getDb, evaluations, roles, pipelineStatus } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/auth-bridge';
import { ScoreChip } from '@/components/ui/score-chip';
import { SalaryBand } from '@/components/ui/salary-band';
import { StatusDot } from '@/components/ui/status-dot';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

function getInitials(s: string) {
  return s.slice(0, 2).toUpperCase();
}

function statusToType(status: string): 'draft' | 'applied' | 'interview' | 'offer' | 'passed' {
  const s = status.toLowerCase();
  if (s.includes('interview') || s.includes('offer') && !s.includes('verbal')) return 'interview';
  if (s.includes('offer')) return 'offer';
  if (s.includes('applied')) return 'applied';
  if (s.includes('reject') || s.includes('discard') || s.includes('skip') || s.includes('pass')) return 'passed';
  return 'draft';
}

export default async function DashboardPage() {
  // Get authenticated user
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  // Query evaluations and roles for this user
  const db = getDb();
  const userEvals = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.userId, authUser.id));

  // Get pending roles (those without evaluations)
  const allRoleIds = await db.select({ id: roles.id }).from(roles);
  const evalRoleIds = new Set(userEvals.map((e) => e.roleId));
  const pendingRoles = allRoleIds.filter((r) => !evalRoleIds.has(r.id));

  // Enrich evaluations with role data and pipeline status
  const allApps = await Promise.all(
    userEvals.map(async (eval_) => {
      const role = await db
        .select()
        .from(roles)
        .where(eq(roles.id, eval_.roleId))
        .limit(1);

      const pipeline = await db
        .select()
        .from(pipelineStatus)
        .where(and(eq(pipelineStatus.userId, authUser.id), eq(pipelineStatus.roleId, eval_.roleId)))
        .limit(1);

      return {
        id: eval_.id,
        company: role[0]?.companyName ?? 'Unknown',
        role: role[0]?.roleTitle ?? 'Unknown',
        scoreNum: eval_.overallScore ? Number(eval_.overallScore) / 20 : null, // Convert 0-100 back to 0-5 for display
        score: eval_.displayId,
        status: pipeline[0]?.status ?? 'evaluating',
        date: eval_.evaluatedAt?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
        reportId: eval_.displayId,
        reportContent: eval_.fullReportMarkdown,
      };
    })
  );

  const avgScore = allApps.length > 0
    ? allApps.reduce((s, a) => s + (a.scoreNum ?? 0), 0) / allApps.length
    : 0;

  const interviews = allApps.filter((a) => statusToType(a.status ?? '') === 'interview');

  // Follow-up engine: Applied/Responded with date > 7 days ago
  const today = new Date();
  const followups = allApps.filter((a) => {
    const s = (a.status ?? '').toLowerCase();
    if (!s.includes('applied') && !s.includes('responded')) return false;
    const d = new Date(a.date);
    return !isNaN(d.getTime()) && (today.getTime() - d.getTime()) / 86400000 > 7;
  });

  const topPicks = [...allApps]
    .filter((a) => (a.scoreNum ?? 0) >= 4)
    .sort((a, b) => (b.scoreNum ?? 0) - (a.scoreNum ?? 0))
    .slice(0, 6);

  // Pending jobs are roles without evaluations
  const pendingJobs = pendingRoles.slice(0, 10);

  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase();

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: 10.5,
            color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            {dayName} · {dateStr} · CDMX
          </div>
          <h1 className="font-editorial" style={{ fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1, color: 'var(--lm-ink)', margin: 0 }}>
            Good morning.
          </h1>
        </div>
        {/* Mode toggle */}
        <div style={{
          display: 'inline-flex', border: '1px solid var(--lm-line)',
          background: 'var(--lm-surface)', padding: 5, borderRadius: 999, gap: 2,
        }}>
          {['Need', 'Leverage', 'Open'].map((m, i) => (
            <div key={m} style={{
              padding: '4px 12px', borderRadius: 999,
              fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500,
              background: i === 1 ? 'var(--lm-ink)' : 'transparent',
              color: i === 1 ? 'var(--lm-bg)' : 'var(--lm-ink-3)',
            }}>
              {m}
            </div>
          ))}
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 12 }}>
        <StatCard
          label="TODAY'S BRIEF"
          value={pendingJobs.length.toString()}
          sub={`${topPicks.length} strong fit`}
          subColor="var(--lm-accent)"
        />
        <StatCard
          label="IN PIPELINE"
          value={allApps.length.toString()}
          sub={interviews.length > 0 ? `${interviews.length} in interview` : 'tracked'}
        />
        <StatCard
          label="AVG SCORE"
          value={avgScore > 0 ? (avgScore * 20).toFixed(0) : '—'}
          sub="out of 100"
        />
        <StatCard
          label="PENDING EVAL"
          value={pendingJobs.length.toString()}
          sub="in backlog"
          highlight={pendingJobs.length > 0}
        />
      </div>

      {/* Today's focus */}
      <div style={{
        background: 'var(--lm-surface)',
        border: '1px solid var(--lm-line)',
        borderRadius: 10, padding: '18px 20px',
      }}>
          <div style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: 10.5,
            color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            TODAY'S FOCUS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingJobs.length > 0 && (
              <FocusItem n={1} text={`Evaluate ${pendingJobs.length} new lead${pendingJobs.length > 1 ? 's' : ''} in the brief`} href="/pipeline" />
            )}
            {followups.length > 0 && (
              <FocusItem n={followups.length > 0 && pendingJobs.length > 0 ? 2 : 1} text={`Follow up with ${followups[0].company}${followups.length > 1 ? ` + ${followups.length - 1} more` : ''}`} href="/outreach" />
            )}
            {topPicks.length > 0 && (
              <FocusItem n={pendingJobs.length > 0 || followups.length > 0 ? 3 : 1} text={`Tailor CV for ${topPicks[0].company}`} href="/cv" />
            )}
            {pendingJobs.length === 0 && followups.length === 0 && topPicks.length === 0 && (
              <FocusItem n={1} text="Scan portals for new leads" href="/pipeline" />
            )}
          </div>
        </div>

      {/* Follow-up engine */}
      {followups.length > 0 && (
        <div style={{
          background: 'var(--lm-signal-soft)',
          border: '1px solid var(--lm-signal)',
          borderRadius: 10, padding: '14px 18px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: 10.5,
              color: 'var(--lm-signal)', letterSpacing: '1.2px', textTransform: 'uppercase',
            }}>
              ⚡ {followups.length} FOLLOW-UP{followups.length > 1 ? 'S' : ''} DUE
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {followups.map((app) => {
              const days = Math.floor((today.getTime() - new Date(app.date).getTime()) / 86400000);
              return (
                <div key={app.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--lm-surface)', borderRadius: 8, padding: '10px 14px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--lm-ink)' }}>
                      {app.company}
                    </span>
                    <span style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12.5, color: 'var(--lm-ink-3)', marginLeft: 8 }}>
                      {app.role}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-geist-mono)', fontSize: 11,
                    color: days > 14 ? 'var(--lm-signal)' : 'var(--lm-ink-3)',
                    fontWeight: days > 14 ? 600 : 400,
                  }}>
                    {days}d ago
                  </span>
                  <Link
                    href={`/outreach`}
                    style={{
                      padding: '4px 12px', borderRadius: 999,
                      background: 'var(--lm-signal)', color: 'white',
                      fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    Follow up →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Territory map */}
      {topPicks.length > 0 && (
        <div style={{
          background: 'var(--lm-canvas)',
          border: '1px solid var(--lm-line)',
          borderRadius: 10, padding: '14px 16px',
          position: 'relative', minHeight: 320,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: 10.5,
              color: 'var(--lm-ink-3)', letterSpacing: '1.2px', textTransform: 'uppercase',
            }}>
              YOUR TERRITORY
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['close = better fit', 'size = score'].map((l) => (
                <span key={l} style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '3px 11px', borderRadius: 999,
                  border: '1px solid var(--lm-line)',
                  background: 'var(--lm-surface)',
                  fontFamily: 'var(--font-albert-sans)', fontSize: 12,
                  color: 'var(--lm-ink-3)',
                }}>
                  {l}
                </span>
              ))}
            </div>
          </div>

          <TerritoryMap picks={topPicks} />
        </div>
      )}

      {/* Recent evaluations table */}
      {allApps.length > 0 && (
        <div style={{
          background: 'var(--lm-surface)',
          border: '1px solid var(--lm-line)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--lm-line)' }}>
            <span style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 17, color: 'var(--lm-ink)' }}>
              Recent evaluations
            </span>
          </div>
          {[...allApps].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((app) => (
            <div key={app.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '10px 20px',
              borderBottom: '1px dashed var(--lm-line)',
            }}>
              <StatusDot status={statusToType(app.status ?? '')} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 14, color: 'var(--lm-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {app.company}
                </div>
                <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: 'var(--lm-ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {app.role}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--lm-ink-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {app.date}
              </div>
              {app.scoreNum != null && app.scoreNum > 0 && (
                <ScoreChip score={Math.round((app.scoreNum ?? 0) * 20)} size="sm"
                  variant={(app.scoreNum ?? 0) >= 4 ? 'default' : (app.scoreNum ?? 0) >= 2.5 ? 'muted' : 'muted'} />
              )}
              {app.reportId && (
                <Link href={`/reports/${app.reportId}`}
                  style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 12, color: 'var(--lm-accent)', textDecoration: 'none' }}>
                  Report →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, subColor, highlight }: {
  label: string; value: string; sub?: string; subColor?: string; highlight?: boolean;
}) {
  return (
    <div style={{
      background: highlight ? 'var(--lm-signal-soft)' : 'var(--lm-surface)',
      border: `1px solid ${highlight ? 'var(--lm-signal)' : 'var(--lm-line)'}`,
      borderRadius: 10, padding: '18px 20px',
    }}>
      <div style={{
        fontFamily: 'var(--font-geist-mono)', fontSize: 10.5,
        color: highlight ? 'var(--lm-signal)' : 'var(--lm-ink-3)',
        letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 32, fontWeight: 700, color: 'var(--lm-ink)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-albert-sans)', fontSize: 13, color: subColor ?? 'var(--lm-ink-2)', marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function FocusItem({ n, text, href }: { n: number; text: string; href: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: 999, flexShrink: 0,
        background: 'var(--lm-ink)', color: 'var(--lm-bg)',
        fontFamily: 'var(--font-geist-mono)', fontSize: 10.5,
      }}>
        {n}
      </span>
      <span style={{ flex: 1, fontFamily: 'var(--font-albert-sans)', fontSize: 13.5, color: 'var(--lm-ink)' }}>
        {text}
      </span>
      <Link href={href} style={{
        padding: '5px 12px', borderRadius: 999,
        border: '1px solid var(--lm-line)', background: 'var(--lm-surface)',
        fontFamily: 'var(--font-albert-sans)', fontSize: 12, fontWeight: 500,
        color: 'var(--lm-ink)', textDecoration: 'none',
      }}>
        Open
      </Link>
    </div>
  );
}

function TerritoryMap({ picks }: { picks: Array<{ company: string; scoreNum: number | null }> }) {
  // Position nodes radially, close = higher score
  const cx = 50, cy = 50;
  const nodes = picks.slice(0, 7).map((p, i) => {
    const score = (p.scoreNum ?? 0) * 20;
    const dist = score >= 85 ? 18 : score >= 75 ? 28 : 36;
    const angle = (i * (360 / Math.max(picks.length, 6))) * (Math.PI / 180);
    const x = cx + dist * Math.cos(angle - Math.PI / 2);
    const y = cy + dist * Math.sin(angle - Math.PI / 2);
    const r = score >= 85 ? 32 : score >= 70 ? 26 : 22;
    const strong = score >= 85;
    return { ...p, x, y, r, strong, score };
  });

  return (
    <div style={{ position: 'relative', height: 280 }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <circle cx="50%" cy="50%" r="80" fill="none" stroke="var(--lm-line)" strokeDasharray="3 5" />
        <circle cx="50%" cy="50%" r="130" fill="none" stroke="var(--lm-line)" strokeDasharray="3 5" />
        <circle cx="50%" cy="50%" r="180" fill="none" stroke="var(--lm-line)" strokeDasharray="3 5" />
      </svg>
      {/* You node */}
      <div style={{
        position: 'absolute',
        left: `calc(50% - 32px)`, top: `calc(50% - 32px)`,
        width: 64, height: 64, borderRadius: '50%',
        background: 'var(--lm-ink)', color: 'var(--lm-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 13,
        border: '2px solid var(--lm-ink)',
        zIndex: 2,
      }}>
        you
      </div>
      {nodes.map((n, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `calc(${n.x}% - ${n.r}px)`,
          top: `calc(${n.y}% - ${n.r}px)`,
          width: n.r * 2, height: n.r * 2,
          borderRadius: '50%',
          background: n.strong ? 'var(--lm-accent)' : 'var(--lm-surface)',
          color: n.strong ? 'var(--lm-accent-on)' : 'var(--lm-ink)',
          border: `1px solid ${n.strong ? 'var(--lm-accent)' : 'var(--lm-line)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: 'var(--font-albert-sans)', fontWeight: 600, fontSize: 11, lineHeight: 1,
          zIndex: 1,
        }}>
          <span>{n.company.slice(0, 6)}</span>
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 9, opacity: 0.85, marginTop: 2 }}>
            {n.score}
          </span>
        </div>
      ))}
    </div>
  );
}
