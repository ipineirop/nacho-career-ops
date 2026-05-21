import { getDb, evaluations, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/auth-bridge';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  const db = getDb();

  // Get user profile
  const userRecord = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);
  const user = userRecord[0];

  // Get evaluation stats
  const evals = await db.select().from(evaluations).where(eq(evaluations.userId, authUser.id));
  const avgScore = evals.length > 0
    ? (evals.reduce((sum, e) => sum + Number(e.overallScore ?? 0), 0) / evals.length / 20).toFixed(1)
    : 'N/A';

  const principles = [
    { label: 'Quick', title: 'Verdict in <15s.', description: 'Paste a role, get a structured evaluation in seconds.' },
    { label: 'Smart', title: 'Fit, not hype.', description: 'Weighted scoring against your actual priorities.' },
    { label: 'Yours', title: 'Your framework.', description: 'Customize archetypes, weights, and narrative.' },
    { label: 'Tracked', title: 'One log.', description: 'Every application in one pipeline. Know your status.' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--lm-bg)', color: 'var(--lm-ink)' }}>
      <div className="sticky top-0 z-50 border-b" style={{ background: 'var(--lm-bg)', borderColor: 'var(--lm-line)' }}>
        <div className="flex items-center justify-between px-8 py-4 gap-6">
          <div className="flex items-center gap-4">
            <div className="font-serif text-2xl font-500 tracking-tight">labra<span style={{ color: 'var(--lm-accent)', fontStyle: 'italic' }}>.</span></div>
            <div className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--lm-ink-3)' }}>Dashboard</div>
          </div>
          <div className="flex-1" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-9">
        <div className="mb-10 max-w-4xl">
          <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--lm-ink-3)' }}>Welcome back</div>
          <h1 className="font-serif text-6xl font-400 leading-none mb-4">Think before you apply.</h1>
          <p className="text-lg leading-relaxed max-w-2xl" style={{ color: 'var(--lm-ink-2)' }}>
            Every role gets a structured evaluation. Score it, track it, compare offers. <strong style={{ color: 'var(--lm-ink)' }}>Your thinking partner for career decisions.</strong>
          </p>
          {evals.length > 0 && (
            <div className="mt-4 text-sm" style={{ color: 'var(--lm-ink-2)' }}>
              You've evaluated <strong>{evals.length}</strong> role{evals.length !== 1 ? 's' : ''} with an average score of <strong>{avgScore}/5</strong>.
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4">
          {principles.map((principle) => (
            <div key={principle.label} className="rounded-xl p-5 border" style={{ background: 'var(--lm-surface)', borderColor: 'var(--lm-line)' }}>
              <div className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--lm-ink-3)' }}>{principle.label}</div>
              <h3 className="font-serif text-xl font-500 leading-tight mb-2" style={{ color: 'var(--lm-ink)' }}>{principle.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--lm-ink-2)' }}>{principle.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
