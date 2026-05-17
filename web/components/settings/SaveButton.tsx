'use client';
import { Loader2, Check } from 'lucide-react';

export function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
    >
      {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
    </button>
  );
}
