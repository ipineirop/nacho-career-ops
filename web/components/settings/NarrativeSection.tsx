'use client';
import { useState, useEffect } from 'react';
import { SaveButton } from './SaveButton';

export function NarrativeSection() {
  const [content, setContent] = useState('');
  const [sha, setSha] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings/narrative').then(r => r.json()).then(({ content, sha }) => { setContent(content); setSha(sha); });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/narrative', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, sha }) });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Edit your archetypes, adaptive framing, proof points, and negotiation scripts. This file is used by every AI evaluation to tailor results to your profile.
      </p>
      <textarea
        value={content}
        onChange={e => { setContent(e.target.value); setSaved(false); }}
        rows={30}
        className="w-full rounded-xl border border-border/60 bg-card px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Loading…"
        spellCheck={false}
      />
      <SaveButton saving={saving} saved={saved} onClick={save} />
    </div>
  );
}
