'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useEvaluatePanel } from './EvaluatePanelProvider';
import { useClassification } from './useClassification';
import { ClassificationChip } from './ClassificationChip';

const SLIDE_MS = 240;

/**
 * The Evaluate panel: bottom sheet on mobile, right drawer on desktop.
 * Slides in via CSS transform; backdrop fades. Esc closes. Body scroll
 * locks while open. The textarea is focused after the slide finishes.
 *
 * Submit: POST /api/evaluations → router.push(/evaluate/[id]). The route
 * itself renders the processing-state placeholder; the real extraction
 * happens server-side in the background.
 *
 * Rules in play here:
 *   01 only `accent` is chromatic           02 only rounded-card / rounded-pill
 *   03 no shadows                            04 only s1..s7 spacing
 *   10 words over glyphs (no icons; "Close" + "Call it" as text)
 */
export function EvaluatePanel() {
  const { isOpen, close } = useEvaluatePanel();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const classification = useClassification(text);

  // Body scroll lock while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Esc closes.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // Focus the textarea after the slide-in animation lands.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => textareaRef.current?.focus(), SLIDE_MS + 40);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Reset transient state when the panel closes (text persists across closes
  // on purpose — easy to reopen and finish; clear after a successful submit).
  // No-op for now beyond resetting error/submitting flags.
  useEffect(() => {
    if (!isOpen) { setSubmitting(false); setError(null); }
  }, [isOpen]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawInput: text,
          inputType: classification.type ?? 'dm',
          classificationConfidence: classification.confidence ?? 0,
        }),
      });
      if (!res.ok) {
        let msg = 'Could not start the evaluation. Try again.';
        try { const body = await res.json(); if (body?.error) msg = body.error; } catch {}
        throw new Error(msg);
      }
      const { id } = await res.json();
      setText('');
      close();
      router.push(`/evaluate/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the evaluation. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        className={[
          'fixed inset-0 z-50 transition-opacity duration-200',
          'bg-ink/35 md:bg-ink/20',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* Panel: bottom sheet (≤768px) → right drawer (≥769px). */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Evaluate"
        aria-hidden={!isOpen}
        className={[
          'fixed z-50 bg-surface text-ink',
          // Mobile sheet
          'left-0 right-0 bottom-0 max-h-[85vh] rounded-t-card pt-s3 px-s5 pb-s6',
          // Desktop drawer
          'md:left-auto md:top-0 md:bottom-0 md:right-0 md:max-h-none md:w-[480px] md:rounded-t-[0] md:rounded-l-card md:pt-s5 md:px-s5 md:pb-s6',
          'flex flex-col',
          'transform transition-transform',
          isOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full',
        ].join(' ')}
        style={{ transitionDuration: `${SLIDE_MS}ms`, transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        {/* Mobile drag handle — purely decorative; tap-to-close lives on the backdrop and Close button. */}
        <div className="md:hidden self-center w-[36px] h-[4px] rounded-pill bg-line mb-s4" aria-hidden="true" />

        <div className="flex justify-between items-center mb-s4">
          <span className="font-mono text-[11px] uppercase tracking-[0.4px] text-ink-3">Evaluate</span>
          <button
            type="button"
            onClick={close}
            className="font-mono text-[11px] uppercase tracking-[0.4px] text-ink-2 hover:text-ink bg-transparent border-0 p-0 cursor-pointer"
          >
            Close
          </button>
        </div>

        <p className="font-body text-[14px] leading-[1.55] text-ink-2 mb-s4">
          Paste anything — a recruiter message, a job description, or a link.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="border border-line rounded-card p-s4 min-h-[180px] md:min-h-[220px] focus-within:border-ink-2 transition-colors">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a recruiter message, job description, or URL"
              rows={6}
              className="w-full bg-transparent border-0 outline-none resize-none font-body text-[14px] leading-[1.55] text-ink placeholder:text-ink-3 min-h-[140px] md:min-h-[180px]"
            />
            <ClassificationChip
              type={classification.type}
              confidence={classification.confidence}
              onChange={classification.setOverride}
            />
          </div>

          {error && (
            <p className="mt-s3 font-mono text-[11px] uppercase tracking-[0.4px] text-signal-ink">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className={[
              'mt-s4 w-full h-s7 rounded-card font-body font-semibold text-[15px] border-0',
              !text.trim() || submitting
                ? 'bg-line text-ink-3 cursor-not-allowed'
                : 'bg-accent hover:bg-accent-h text-accent-on cursor-pointer',
            ].join(' ')}
          >
            {submitting ? 'Calling it…' : 'Call it'}
          </button>
        </form>
      </div>
    </>
  );
}
