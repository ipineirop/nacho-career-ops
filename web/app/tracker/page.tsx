import { getDb, evaluations, roles, pipelineStatus } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/auth-bridge';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function TrackerPage() {
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  const db = getDb();
  const rows = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.userId, authUser.id));

  const apps = await Promise.all(
    rows.map(async (r) => {
      const roleData = await db
        .select()
        .from(roles)
        .where(eq(roles.id, r.roleId))
        .limit(1);

      const statusData = await db
        .select()
        .from(pipelineStatus)
        .where(and(eq(pipelineStatus.userId, authUser.id), eq(pipelineStatus.roleId, r.roleId)))
        .limit(1);

      return {
        company: roleData[0]?.companyName ?? 'Unknown',
        role: roleData[0]?.roleTitle ?? 'Unknown',
        status: statusData[0]?.status ?? r.recommendation ?? 'Evaluated',
        score: r.overallScore ? Number(r.overallScore) / 20 : 0,
        date: r.evaluatedAt?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
      };
    })
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--lm-bg)', color: 'var(--lm-ink)' }}>
      <div className="sticky top-0 z-50 border-b" style={{ background: 'var(--lm-bg)', borderColor: 'var(--lm-line)' }}>
        <div className="flex items-center justify-between px-8 py-4 gap-6">
          <div className="flex items-center gap-4">
            <div className="font-serif text-2xl font-500 tracking-tight">labra<span style={{ color: 'var(--lm-accent)', fontStyle: 'italic' }}>.</span></div>
            <div className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--lm-ink-3)' }}>Tracker</div>
          </div>
          <div className="flex-1" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-9">
        <div className="mb-10 max-w-3xl">
          <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--lm-ink-3)' }}>Pipeline</div>
          <h1 className="font-serif text-6xl font-400 leading-none mb-4">Every role, one <em>log.</em></h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--lm-ink-2)' }}>Track every opportunity from first contact to offer. Status, score, documents, notes.</p>
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--lm-line)' }}>
          <table className="w-full">
            <thead style={{ borderBottom: '1px solid var(--lm-line)', background: 'var(--lm-surface-2)' }}>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-500 uppercase tracking-widest" style={{ color: 'var(--lm-ink-3)' }}>Company</th>
                <th className="px-6 py-4 text-left text-xs font-500 uppercase tracking-widest" style={{ color: 'var(--lm-ink-3)' }}>Role</th>
                <th className="px-6 py-4 text-left text-xs font-500 uppercase tracking-widest" style={{ color: 'var(--lm-ink-3)' }}>Status</th>
                <th className="px-6 py-4 text-left text-xs font-500 uppercase tracking-widest" style={{ color: 'var(--lm-ink-3)' }}>Score</th>
                <th className="px-6 py-4 text-left text-xs font-500 uppercase tracking-widest" style={{ color: 'var(--lm-ink-3)' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {apps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center" style={{ color: 'var(--lm-ink-3)' }}>No applications yet. Start by evaluating a role!</td>
                </tr>
              ) : (
                apps.map((app, idx) => (
                  <tr key={`${app.company}-${idx}`} style={{ borderBottom: '1px solid var(--lm-line)', background: idx % 2 === 0 ? 'var(--lm-surface)' : 'var(--lm-surface-2)' }}>
                    <td className="px-6 py-4 font-500" style={{ color: 'var(--lm-ink)' }}>{app.company}</td>
                    <td className="px-6 py-4" style={{ color: 'var(--lm-ink-2)' }}>{app.role}</td>
                    <td className="px-6 py-4"><span className="px-3 py-1 rounded-full text-xs font-500" style={{ background: 'var(--lm-accent-soft)', color: 'var(--lm-accent)' }}>{app.status}</span></td>
                    <td className="px-6 py-4" style={{ color: 'var(--lm-ink-2)' }}>{app.score.toFixed(1)}/5</td>
                    <td className="px-6 py-4 font-mono text-sm" style={{ color: 'var(--lm-ink-3)' }}>{app.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
