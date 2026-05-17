'use client';
import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

export function TagInput({ values, onChange, placeholder }: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  function add() {
    const v = input.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput('');
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !input && values.length) onChange(values.slice(0, -1));
  }

  return (
    <div className="flex flex-wrap gap-1.5 min-h-9 rounded-lg border border-border bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={values.length === 0 ? placeholder : ''}
        className="flex-1 min-w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
