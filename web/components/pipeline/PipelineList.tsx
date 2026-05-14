'use client';

import { useState } from 'react';
import type { PipelineJob } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, X } from 'lucide-react';

const PAGE_SIZE = 50;

export function PipelineList({ initialJobs }: { initialJobs: PipelineJob[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [page, setPage] = useState(1);
  const [discarding, setDiscarding] = useState<string | null>(null);

  const pending = jobs.filter((j) => !j.checked);
  const evaluated = jobs.filter((j) => j.checked && j.evalId);
  const visible = pending.slice(0, page * PAGE_SIZE);

  async function handleDiscard(url: string) {
    setDiscarding(url);
    try {
      const res = await fetch('/api/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, action: 'discard' }),
      });
      if (!res.ok) throw new Error('Failed');
      setJobs((prev) => prev.map((j) => (j.url === url ? { ...j, checked: true } : j)));
    } catch {
      alert('Failed to discard. Please try again.');
    } finally {
      setDiscarding(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{pending.length}</strong> pending</span>
        <span><strong className="text-foreground">{evaluated.length}</strong> evaluated</span>
      </div>

      {pending.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">Pipeline is clear — no pending items.</p>
      )}

      <div className="space-y-1">
        {visible.map((job) => (
          <div
            key={job.url}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 hover:bg-accent/30"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{job.company || new URL(job.url).hostname}</p>
                {job.role && (
                  <span className="text-xs text-muted-foreground truncate">· {job.role}</span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{job.url}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink size={14} />
              </a>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                disabled={discarding === job.url}
                onClick={() => handleDiscard(job.url)}
                title="Discard"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {visible.length < pending.length && (
        <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
          Load more ({pending.length - visible.length} remaining)
        </Button>
      )}

      {evaluated.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Evaluated ({evaluated.length})
          </summary>
          <div className="mt-2 space-y-1">
            {evaluated.map((job) => (
              <div
                key={job.url}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground"
              >
                <span className="text-xs font-mono">#{job.evalId}</span>
                <span className="truncate text-sm">{job.company}</span>
                {job.score && <span className="ml-auto text-xs shrink-0">{job.score}</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
