'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  label: string;
  command: string;
  description: string;
  tip?: string;
}

export function CliCard({ label, command, description, tip }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-2">{label}</h3>
      <div className="flex items-center gap-2 mb-2">
        <code className="flex-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-mono text-foreground truncate">
          {command}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Copy"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      {tip && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
          💡 {tip}
        </p>
      )}
    </div>
  );
}
