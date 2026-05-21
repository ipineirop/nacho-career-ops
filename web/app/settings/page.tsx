import { getAuthUserId } from '@/lib/auth-bridge';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const decisions = [
  { label: 'Archetypes', title: 'Your roles.', description: 'Define the roles and seniority you target.' },
  { label: 'Weights', title: 'Your priorities.', description: 'How much each factor matters to you.' },
  { label: 'Narrative', title: 'Your story.', description: 'Background, proof points, unique angles.' },
  { label: 'Locations', title: 'Your places.', description: 'Where you live, want to work, or travel.' },
];

export default async function SettingsPage() {
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  return (
    <div className="min-h-screen" style={{ background: 'var(--lm-bg)', color: 'var(--lm-ink)' }}>
      <div className="sticky top-0 z-50 border-b" style={{ background: 'var(--lm-bg)', borderColor: 'var(--lm-line)' }}>
        <div className="flex items-center justify-between px-8 py-4 gap-6">
          <div className="flex items-center gap-4">
            <div className="font-serif text-2xl font-500 tracking-tight">labra<span style={{ color: 'var(--lm-accent)', fontStyle: 'italic' }}>.</span></div>
            <div className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--lm-ink-3)' }}>Settings</div>
          </div>
          <div className="flex-1" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-9">
        <div className="mb-10 max-w-3xl">
          <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--lm-ink-3)' }}>Personalization</div>
          <h1 className="font-serif text-6xl font-400 leading-none mb-4">Your profile, plainly.</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--lm-ink-2)' }}>
            Everything that makes <strong>you</strong> unique. Archetypes, weights, proof points, location policy.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {decisions.map((decision) => (
            <div key={decision.label} className="rounded-xl p-6 border cursor-pointer transition-all" style={{ background: 'var(--lm-surface)', borderColor: 'var(--lm-line)' }}>
              <div className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--lm-ink-3)' }}>{decision.label}</div>
              <h3 className="font-serif text-xl font-500 leading-tight mb-2" style={{ color: 'var(--lm-ink)' }}>{decision.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--lm-ink-2)' }}>{decision.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
