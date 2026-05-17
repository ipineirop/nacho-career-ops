'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  text: string;
  done: boolean;
}

const BLOCK_LABELS: Record<string, string> = {
  A: 'Role Summary', B: 'CV Match', C: 'Level & Strategy',
  D: 'Compensation', E: 'CV Personalization', F: 'Interview Prep', G: 'Legitimacy',
};

function blockLabel(heading: string): string {
  const m = heading.match(/Bloque\s+([A-G])/i) || heading.match(/Block\s+([A-G])/i);
  if (m) return `Block ${m[1]} — ${BLOCK_LABELS[m[1]] ?? ''}`;
  return heading;
}

export function LiveEvalView({ text, done }: Props) {
  if (!text) return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 size={13} className="animate-spin text-primary" /> Starting…
    </div>
  );

  const parts = text.split(/(?=\n## |\n# )/);
  const completedParts = done ? parts : parts.slice(0, -1);
  const inProgress = done ? null : parts[parts.length - 1];

  return (
    <div className="space-y-3">
      {completedParts.filter(p => p.trim()).map((part, i) => {
        const heading = part.split('\n')[0].replace(/^#+\s*/, '').trim();
        return (
          <div key={i} className="rounded-lg border border-border/40 bg-background overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-border/40 bg-muted/20 px-3 py-1.5">
              <CheckCircle2 size={11} className="text-emerald-500" />
              <span className="text-[11px] font-semibold text-muted-foreground">{blockLabel(heading)}</span>
            </div>
            <div className="px-3 py-3 prose prose-xs max-w-none
              prose-headings:font-semibold prose-headings:text-sm prose-headings:text-foreground
              prose-table:text-xs prose-th:font-semibold prose-code:text-xs
              prose-p:text-sm prose-li:text-sm prose-strong:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.trim()}</ReactMarkdown>
            </div>
          </div>
        );
      })}

      {inProgress && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-primary/20 px-3 py-1.5">
            <Loader2 size={11} className="animate-spin text-primary" />
            <span className="text-[11px] font-semibold text-primary">Analyzing…</span>
          </div>
          <pre className="px-3 py-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-hidden">
            {inProgress.slice(-600)}
          </pre>
        </div>
      )}
    </div>
  );
}
