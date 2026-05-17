'use client';

import { useState, useRef, useEffect } from 'react';
import { FileUser, Sparkles, Printer, Loader2, ChevronDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Application {
  id: string;
  company: string;
  role: string;
  score: string | null;
  reportContent: string | null;
}

export function CVGenerator({ applications }: { applications: Application[] }) {
  const [source, setSource] = useState<'tracker' | 'paste'>('tracker');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [jd, setJd] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // When user picks from tracker, pre-fill JD from report content
  useEffect(() => {
    if (selectedApp?.reportContent) {
      setJd(selectedApp.reportContent.slice(0, 8000));
    }
  }, [selectedApp]);

  async function generate() {
    const jdText = source === 'paste' ? jd : (selectedApp?.reportContent ?? jd);
    if (!jdText.trim()) return;

    setStatus('loading');
    setHtml('');
    setError('');

    try {
      const res = await fetch('/api/ai/cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd: jdText,
          applicationId: source === 'tracker' ? selectedApp?.id : undefined,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setHtml(data.html);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('error');
    }
  }

  function printCv() {
    iframeRef.current?.contentWindow?.print();
  }

  const canGenerate =
    status !== 'loading' &&
    (source === 'paste' ? jd.trim().length > 50 : selectedApp !== null);

  return (
    <div className="flex h-full gap-6">
      {/* Left panel — controls */}
      <div className="w-80 shrink-0 flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileUser size={18} className="text-primary" />
            CV Generator
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Tailored CV from a job description, browser print → PDF
          </p>
        </div>

        {/* Source toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          <button
            onClick={() => setSource('tracker')}
            className={cn(
              'flex-1 py-2 px-3 transition-colors',
              source === 'tracker'
                ? 'bg-primary text-white font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            From tracker
          </button>
          <button
            onClick={() => setSource('paste')}
            className={cn(
              'flex-1 py-2 px-3 transition-colors',
              source === 'paste'
                ? 'bg-primary text-white font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Paste JD
          </button>
        </div>

        {source === 'tracker' ? (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Select application
            </label>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2.5 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={selectedApp?.id ?? ''}
                onChange={(e) => {
                  const app = applications.find((a) => a.id === e.target.value);
                  setSelectedApp(app ?? null);
                }}
              >
                <option value="">— pick a company / role —</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.company} — {app.role} {app.score ? `(${app.score})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-muted-foreground" />
            </div>

            {selectedApp && !selectedApp.reportContent && (
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2">
                No report content found. Paste the JD below for better results.
              </p>
            )}

            {selectedApp && !selectedApp.reportContent && (
              <textarea
                rows={6}
                placeholder="Paste JD or role description here…"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Job description
            </label>
            <textarea
              rows={12}
              placeholder="Paste a job description or URL…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
          </div>
        )}

        <Button
          onClick={generate}
          disabled={!canGenerate}
          className="w-full gap-2"
        >
          {status === 'loading' ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generating… (~30s)
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate tailored CV
            </>
          )}
        </Button>

        {status === 'done' && (
          <Button variant="outline" onClick={printCv} className="w-full gap-2">
            <Printer size={14} />
            Print / Save as PDF
          </Button>
        )}

        {status === 'error' && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {status === 'done' && source === 'tracker' && selectedApp && (
          <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-md px-3 py-2">
            CV saved to documents. Tracker updated: PDF ✅
          </p>
        )}
      </div>

      {/* Right panel — preview */}
      <div className="flex-1 min-w-0 rounded-xl border border-border overflow-hidden bg-muted/30 flex flex-col">
        {status === 'idle' && (
          <div className="flex flex-1 items-center justify-center flex-col gap-3 text-muted-foreground">
            <FileText size={36} className="opacity-20" />
            <p className="text-sm">Your tailored CV will appear here</p>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex flex-1 items-center justify-center flex-col gap-3 text-muted-foreground">
            <Loader2 size={32} className="animate-spin opacity-40" />
            <p className="text-sm">Tailoring your CV to this role…</p>
            <p className="text-xs opacity-60">Reading JD keywords, reordering bullets, injecting context</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-1 items-center justify-center text-destructive/60 text-sm">
            Generation failed — try again
          </div>
        )}

        {status === 'done' && html && (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            className="flex-1 w-full border-0"
            title="CV Preview"
            sandbox="allow-same-origin allow-modals"
          />
        )}
      </div>
    </div>
  );
}
