'use client';
import { useState, useEffect } from 'react';
import { TagInput } from './TagInput';
import { SaveButton } from './SaveButton';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Company { name: string; careers_url: string; enabled: boolean; notes?: string; }
interface LIQuery { keywords: string; location: string; remote_only: boolean; enabled: boolean; }

export function PortalsSection() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [sha, setSha] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings/portals').then(r => r.json()).then(({ data, sha }) => { setData(data); setSha(sha); });
  }, []);

  function setField(path: string, value: unknown) {
    setData(prev => { if (!prev) return prev; const next = structuredClone(prev) as Record<string, unknown>; (next as Record<string,unknown>)[path] = value; setSaved(false); return next; });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/portals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, sha }) });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally { setSaving(false); }
  }

  if (!data) return <div className="py-8 text-sm text-muted-foreground">Loading…</div>;

  const filter = data.title_filter as Record<string, unknown> ?? {};
  const companies = (data.tracked_companies as Company[]) ?? [];
  const liQueries = (data.linkedin_queries as LIQuery[]) ?? [];

  return (
    <div className="space-y-8">
      {/* Title filters */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Title Filters</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Include titles containing</label>
            <TagInput values={(filter.positive as string[]) ?? []} onChange={v => setField('title_filter', { ...filter, positive: v })} placeholder="Head of Operations, Director of…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Exclude titles containing</label>
            <TagInput values={(filter.negative as string[]) ?? []} onChange={v => setField('title_filter', { ...filter, negative: v })} placeholder="Junior, Intern, Engineer…" />
          </div>
        </div>
      </section>

      {/* LinkedIn queries */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">LinkedIn Queries</h3>
          <button onClick={() => setField('linkedin_queries', [...liQueries, { keywords: '', location: '', remote_only: false, enabled: true }])}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Plus size={12} /> Add query</button>
        </div>
        <div className="space-y-2">
          {liQueries.map((q, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
              <button onClick={() => setField('linkedin_queries', liQueries.map((x, j) => j === i ? { ...x, enabled: !x.enabled } : x))}
                className={q.enabled ? 'text-primary' : 'text-muted-foreground'}>
                {q.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              </button>
              <input value={q.keywords} onChange={e => setField('linkedin_queries', liQueries.map((x, j) => j === i ? { ...x, keywords: e.target.value } : x))}
                placeholder="Keywords (e.g. Head of Operations)" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              <input value={q.location} onChange={e => setField('linkedin_queries', liQueries.map((x, j) => j === i ? { ...x, location: e.target.value } : x))}
                placeholder="Location" className="w-32 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={q.remote_only} onChange={e => setField('linkedin_queries', liQueries.map((x, j) => j === i ? { ...x, remote_only: e.target.checked } : x))} />
                Remote
              </label>
              <button onClick={() => setField('linkedin_queries', liQueries.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </section>

      {/* Companies */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tracked Companies ({companies.filter(c => c.enabled !== false).length} enabled)</h3>
          <button onClick={() => setField('tracked_companies', [...companies, { name: '', careers_url: '', enabled: true }])}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Plus size={12} /> Add company</button>
        </div>
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
            {companies.map((c, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/20">
                <button onClick={() => setField('tracked_companies', companies.map((x, j) => j === i ? { ...x, enabled: !x.enabled } : x))}
                  className={c.enabled !== false ? 'text-primary shrink-0' : 'text-muted-foreground shrink-0'}>
                  {c.enabled !== false ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                </button>
                <input value={c.name} onChange={e => setField('tracked_companies', companies.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  placeholder="Company name" className="w-36 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground" />
                <input value={c.careers_url} onChange={e => setField('tracked_companies', companies.map((x, j) => j === i ? { ...x, careers_url: e.target.value } : x))}
                  placeholder="https://careers.company.com" className="flex-1 bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground" />
                <button onClick={() => setField('tracked_companies', companies.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SaveButton saving={saving} saved={saved} onClick={save} />
    </div>
  );
}
