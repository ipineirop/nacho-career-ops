'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, Loader2, CheckCircle2, XCircle, ExternalLink, Clock } from 'lucide-react';
import type { WorkflowStatus } from '@/lib/github';

interface Props {
  workflow: string;
  label: string;
  description: string;
  tip?: string;
}

type LocalStatus = WorkflowStatus['status'] | 'triggering';

function StatusIndicator({ status, conclusion }: { status: LocalStatus; conclusion: string | null }) {
  if (status === 'triggering' || status === 'queued' || status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
        <Loader2 size={11} className="animate-spin" />
        {status === 'triggering' ? 'Starting…' : status === 'queued' ? 'Queued' : 'Running'}
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 size={11} />
        Done
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
        <XCircle size={11} />
        Failed
      </span>
    );
  }
  return null;
}

export function RunnerCard({ workflow, label, description, tip }: Props) {
  const [status, setStatus] = useState<LocalStatus>('idle');
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [conclusion, setConclusion] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/actions/status?workflow=${workflow}`);
    if (!res.ok) return;
    const data: WorkflowStatus = await res.json();
    setStatus(data.status);
    setConclusion(data.conclusion);
    if (data.url) setRunUrl(data.url);
    if (data.createdAt) setLastRun(data.createdAt);
    return data.status;
  }, [workflow]);

  // Initial status fetch on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while active
  useEffect(() => {
    if (status !== 'queued' && status !== 'in_progress' && status !== 'triggering') return;
    const interval = setInterval(async () => {
      const s = await fetchStatus();
      if (s === 'completed' || s === 'failed' || s === 'idle') {
        clearInterval(interval);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [status, fetchStatus]);

  async function handleRun() {
    setStatus('triggering');
    try {
      const res = await fetch('/api/actions/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow }),
      });
      if (!res.ok) throw new Error('Trigger failed');
      setStatus('queued');
    } catch {
      setStatus('failed');
    }
  }

  const isActive = status === 'triggering' || status === 'queued' || status === 'in_progress';
  const isDone = status === 'completed' || status === 'failed';

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1">
            <h3 className="text-sm font-semibold">{label}</h3>
            {status !== 'idle' && (
              <StatusIndicator status={status} conclusion={conclusion} />
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          {tip && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
              💡 {tip}
            </p>
          )}
          {isDone && lastRun && (
            <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock size={10} />
              Last run {new Date(lastRun).toLocaleString()}
              {status === 'completed' && (
                <span className="ml-1 text-emerald-600">· Dashboard will update on next refresh</span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {runUrl && (
            <a
              href={runUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="View run logs on GitHub"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button
            onClick={handleRun}
            disabled={isActive}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isActive ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isActive ? 'Running' : 'Run'}
          </button>
        </div>
      </div>
    </div>
  );
}
