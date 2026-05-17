'use client';

import { useState } from 'react';
import { Copy, Check, Terminal, Laptop } from 'lucide-react';

interface CommandItem {
  label: string;
  command: string;
  description: string;
  tip?: string;
  isLocal?: boolean;
}

interface Props {
  category: string;
  description: string;
  items: CommandItem[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title="Copy command"
    >
      {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
    </button>
  );
}

export function CommandGroup({ category, description, items }: Props) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="font-semibold text-sm">{category}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.command}
            className="rounded-lg border border-border/60 bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.isLocal && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      <Laptop size={9} /> local shell
                    </span>
                  )}
                  {!item.isLocal && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                      <Terminal size={9} /> Claude Code
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-foreground">
                    {item.command}
                  </code>
                  <CopyButton text={item.command} />
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                {item.tip && (
                  <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                    💡 {item.tip}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
