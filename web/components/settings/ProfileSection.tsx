'use client';
import { useState, useEffect } from 'react';
import { TagInput } from './TagInput';
import { SaveButton } from './SaveButton';

export function ProfileSection() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [sha, setSha] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings/profile').then(r => r.json()).then(({ data, sha }) => {
      setData(data); setSha(sha);
    });
  }, []);

  function set(path: string, value: unknown) {
    setData(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const keys = path.split('.');
      let obj: Record<string, unknown> = next as Record<string, unknown>;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]] as Record<string, unknown>;
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, sha }) });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally { setSaving(false); }
  }

  if (!data) return <div className="py-8 text-sm text-muted-foreground">Loading…</div>;

  const c = data.candidate as Record<string, unknown> ?? {};
  const targets = data.target_roles as Record<string, unknown> ?? {};
  const comp = data.compensation as Record<string, unknown> ?? {};
  const narrative = data.narrative as Record<string, unknown> ?? {};

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Identity</h3>
        <div className="grid grid-cols-2 gap-4">
          {[['Full name', 'candidate.full_name', c.full_name], ['Email', 'candidate.email', c.email],
            ['Phone', 'candidate.phone', c.phone], ['LinkedIn', 'candidate.linkedin', c.linkedin],
            ['Location', 'candidate.location', c.location], ['Timezone', 'candidate.timezone', c.timezone]
          ].map(([label, path, val]) => (
            <div key={path as string}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{label as string}</label>
              <input value={(val as string) ?? ''} onChange={e => set(path as string, e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Target Roles</h3>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Primary roles (press Enter to add)</label>
          <TagInput
            values={(targets.primary as string[]) ?? []}
            onChange={v => set('target_roles.primary', v)}
            placeholder="Add a target role title…"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Compensation</h3>
        <div className="grid grid-cols-3 gap-4">
          {[['Target range', 'compensation.target_range', comp.target_range],
            ['Minimum', 'compensation.minimum', comp.minimum],
            ['Currency', 'compensation.currency', comp.currency]
          ].map(([label, path, val]) => (
            <div key={path as string}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{label as string}</label>
              <input value={(val as string) ?? ''} onChange={e => set(path as string, e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Exit Story</h3>
        <textarea
          value={(narrative.exit_story as string) ?? ''}
          onChange={e => set('narrative.exit_story', e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </section>

      <SaveButton saving={saving} saved={saved} onClick={save} />
    </div>
  );
}
