'use client';

import { useState } from 'react';
import { useEvaluations, type Evaluation } from '@/contexts/EvaluationsContext';
import { LiveEvalView } from './LiveEvalView';
import { X, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Trash2, Sparkles } from 'lucide-react';

function formatDuration(start: Date, end?: Date): string {
  const ms = (end ?? new Date()).getTime() - start.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function StatusBadge({ status }: { status: Evaluation['status'] }) {
  if (status === 'streaming') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
      <Loader2 size={10} className="animate-spin" /> Running
    </span>
  );
  if (status === 'done') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
      <CheckCircle2 size={10} /> Done
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
      <AlertCircle size={10} /> Error
    </span>
  );
}

function EvalCard({ ev }: { ev: Evaluation }) {
  const [expanded, setExpanded] = useState(ev.status === 'streaming');

  return (
    <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{ev.label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge status={ev.status} />
            <span className="text-[10px] text-muted-foreground">
              {formatDuration(ev.startedAt, ev.endedAt)}
            </span>
          </div>
        </div>
        <div className="ml-2 shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-4 py-4 max-h-[60vh] overflow-y-auto">
          {ev.status === 'error' && (
            <p className="text-sm text-red-600">Evaluation failed. Please try again.</p>
          )}
          {ev.status === 'error' ? (
            <p className="text-sm text-red-600">Evaluation failed. Please try again.</p>
          ) : (
            <LiveEvalView text={ev.text} done={ev.status === 'done'} />
          )}
          {ev.status === 'done' && (
            <div className="mt-4 flex gap-2">
              <a href="/tracker" className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                View in Tracker →
              </a>
              <a href="/reports" className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted transition-colors">
                Reports →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EvaluationsPanel() {
  const { evaluations, panelOpen, setPanelOpen, startEvaluation, clearDone } = useEvaluations();
  const [jd, setJd] = useState('');
  const [starting, setStarting] = useState(false);

  const running = evaluations.filter((e) => e.status === 'streaming').length;
  const hasDone = evaluations.some((e) => e.status !== 'streaming');

  function handleStart() {
    if (!jd.trim() || starting) return;
    setStarting(true);
    startEvaluation(jd.trim());
    setJd('');
    setTimeout(() => setStarting(false), 500);
  }

  if (!panelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setPanelOpen(false)} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl border-l border-border/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Evaluations</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {running > 0 ? `${running} running` : 'No active evaluations'}
              {evaluations.length > 0 && ` · ${evaluations.length} total`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasDone && (
              <button onClick={clearDone} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Trash2 size={11} /> Clear done
              </button>
            )}
            <button onClick={() => setPanelOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* New evaluation input */}
        <div className="border-b border-border/40 px-5 py-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New evaluation</p>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste a job description here…"
            rows={3}
            className="w-full rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          <button
            onClick={handleStart}
            disabled={!jd.trim() || starting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles size={12} />
            {starting ? 'Starting…' : 'Evaluate'}
          </button>
        </div>

        {/* Evaluations list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {evaluations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles size={24} className="text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No evaluations yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Paste a job description above to start.</p>
            </div>
          )}
          {evaluations.map((ev) => (
            <EvalCard key={ev.id} ev={ev} />
          ))}
        </div>
      </div>
    </>
  );
}
