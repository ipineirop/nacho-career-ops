'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface Block {
  heading: string;
  content: string;
  done: boolean;
}

// Split markdown into labeled blocks on ## headings
function parseBlocks(text: string): Block[] {
  const parts = text.split(/(?=\n## |\n# )/);
  return parts
    .filter((p) => p.trim())
    .map((part) => {
      const lines = part.split('\n');
      const heading = lines[0].replace(/^#+\s*/, '').trim();
      const content = part.trim();
      return { heading, content, done: true };
    });
}

const BLOCK_LABELS: Record<string, string> = {
  A: 'Role Summary',
  B: 'CV Match',
  C: 'Level & Strategy',
  D: 'Compensation',
  E: 'CV Personalization',
  F: 'Interview Prep',
  G: 'Legitimacy Check',
};

function blockLabel(heading: string): string {
  const match = heading.match(/Bloque\s+([A-G])/i) || heading.match(/Block\s+([A-G])/i);
  if (match) return `Block ${match[1]} — ${BLOCK_LABELS[match[1]] ?? ''}`;
  return heading;
}

interface Props {
  stream: ReadableStream<Uint8Array> | null;
  onComplete?: (text: string) => void;
}

export function StreamingOutput({ stream, onComplete }: Props) {
  const [fullText, setFullText] = useState('');
  const [completedBlocks, setCompletedBlocks] = useState<Block[]>([]);
  const [currentBlock, setCurrentBlock] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!stream) return;
    setFullText('');
    setCompletedBlocks([]);
    setCurrentBlock('');
    setDone(false);

    let accumulated = '';
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    async function read() {
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        // Split on ## headings to find complete blocks
        const blockSplit = accumulated.split(/(?=\n## |\n# )/);

        // All but the last segment are "complete" blocks
        const complete = blockSplit.slice(0, -1);
        const inProgress = blockSplit[blockSplit.length - 1] ?? '';

        if (complete.length > 0) {
          setCompletedBlocks(
            complete
              .filter((p) => p.trim())
              .map((part) => {
                const lines = part.split('\n');
                const heading = lines[0].replace(/^#+\s*/, '').trim();
                return { heading, content: part.trim(), done: true };
              }),
          );
        }

        setCurrentBlock(inProgress);
        setFullText(accumulated);
      }

      // On stream end, move everything to completed
      const allBlocks = parseBlocks(accumulated);
      setCompletedBlocks(allBlocks);
      setCurrentBlock('');
      setDone(true);
      onComplete?.(accumulated);
    }

    read().catch(console.error);
    return () => { reader.cancel(); };
  }, [stream, onComplete]);

  if (!stream && !fullText) return null;

  const totalBlocks = 9; // A-G + Score + Post-eval
  const progress = Math.min((completedBlocks.length / totalBlocks) * 100, 95);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      {!done && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-3 border-b border-border/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 size={13} className="animate-spin text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                {completedBlocks.length > 0
                  ? `Analyzing… ${completedBlocks.length} of ${totalBlocks} sections complete`
                  : 'Starting evaluation…'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Completed blocks */}
      {completedBlocks.map((block, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-4 py-2.5">
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            <span className="text-xs font-semibold text-foreground">
              {blockLabel(block.heading)}
            </span>
          </div>
          <div className="px-5 py-4 prose prose-sm max-w-none dark:prose-invert
            prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground
            prose-table:text-xs prose-th:font-semibold prose-th:bg-muted/30
            prose-td:align-top
            prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:text-xs
            prose-strong:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
          </div>
        </div>
      ))}

      {/* In-progress block — plain text only to avoid markdown parse overhead during stream */}
      {currentBlock && (
        <div className="rounded-xl border border-primary/30 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2.5">
            <Loader2 size={13} className="animate-spin text-primary shrink-0" />
            <span className="text-xs font-semibold text-primary">Analyzing…</span>
          </div>
          <div className="px-5 py-4 text-sm text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
            {currentBlock}
            <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
          </div>
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold text-emerald-800">Evaluation complete</span>
        </div>
      )}

    </div>
  );
}
