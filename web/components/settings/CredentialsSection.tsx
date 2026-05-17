'use client';
import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, Loader2 } from 'lucide-react';

interface Credential { key: string; masked: string; hasValue: boolean; }

const LABELS: Record<string, { label: string; hint: string }> = {
  linkedin_email:    { label: 'LinkedIn Email',    hint: 'Used for browser-based LinkedIn scanning' },
  linkedin_password: { label: 'LinkedIn Password', hint: 'Used for browser-based LinkedIn scanning' },
  apify_api_token:   { label: 'Apify API Token',   hint: 'Used for LinkedIn scanning via Apify (no ban risk). Get at console.apify.com' },
  gemini_api_key:    { label: 'Gemini API Key',     hint: 'Optional — for Gemini-based evaluations' },
};

function CredentialRow({ cred }: { cred: Credential }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const meta = LABELS[cred.key];

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/settings/credentials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: cred.key, value }) });
      setSaved(true); setEditing(false); setValue('');
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{meta.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{meta.hint}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && <Check size={14} className="text-emerald-600" />}
          {cred.hasValue && !editing && (
            <span className="text-xs font-mono text-muted-foreground">{cred.masked}</span>
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
              {cred.hasValue ? 'Update' : 'Set'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && save()}
                  placeholder="Enter value…"
                  autoFocus
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-ring w-64"
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <button onClick={save} disabled={!value.trim() || saving}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setValue(''); }} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CredentialsSection() {
  const [creds, setCreds] = useState<Credential[]>([]);

  useEffect(() => {
    fetch('/api/settings/credentials').then(r => r.json()).then(setCreds);
  }, []);

  return (
    <div className="space-y-3">
      {creds.map(c => <CredentialRow key={c.key} cred={c} />)}
      <p className="text-xs text-muted-foreground pt-2">
        Credentials are stored encrypted in the database, never in code or GitHub.
        Anthropic API key and GitHub token are managed via Vercel environment variables.
      </p>
    </div>
  );
}
