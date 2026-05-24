'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type InputType = 'dm' | 'jd' | 'url';

interface ClassificationState {
  type: InputType | null;
  confidence: number | null;       // 0..1
  setOverride: (type: InputType) => void;
  pending: boolean;
}

// Prefer false negatives — anything ambiguous goes through the classifier.
const URL_RE = /^https?:\/\/\S+$/i;

const DEBOUNCE_MS = 400;

/**
 * Classify the pasted text after the user pauses typing. URLs are detected
 * locally with confidence 1.0 (no API call). Everything else is debounced and
 * POSTed to /api/classify; the hook exposes `pending` while in flight so the
 * UI can show a quiet ellipsis. `setOverride` is for the user's manual pick
 * via the chip — local-only, no API.
 */
export function useClassification(text: string): ClassificationState {
  const [type, setType] = useState<InputType | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const overrideRef = useRef(false);
  const aborterRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Manual override wins until the text changes again.
    if (overrideRef.current) return;

    const trimmed = text.trim();
    if (!trimmed) {
      setType(null); setConfidence(null); setPending(false);
      aborterRef.current?.abort();
      return;
    }
    if (URL_RE.test(trimmed)) {
      setType('url'); setConfidence(1.0); setPending(false);
      aborterRef.current?.abort();
      return;
    }

    // Debounce the API call.
    setPending(true);
    const handle = setTimeout(async () => {
      aborterRef.current?.abort();
      const ac = new AbortController();
      aborterRef.current = ac;
      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
          signal: ac.signal,
        });
        if (!res.ok) throw new Error('classify failed');
        const data = await res.json() as { type?: InputType; confidence?: number };
        if (ac.signal.aborted) return;
        if (overrideRef.current) return;
        if (data.type === 'dm' || data.type === 'jd' || data.type === 'url') {
          setType(data.type);
          setConfidence(typeof data.confidence === 'number' ? data.confidence : null);
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        // Soft-fail: leave previous classification, just clear pending.
      } finally {
        if (aborterRef.current === ac) setPending(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [text]);

  // When the user keeps typing, clear the override so the classifier can take
  // over again. Reset the override flag if the user manually edits.
  const previousTextRef = useRef(text);
  useEffect(() => {
    if (previousTextRef.current !== text) {
      overrideRef.current = false;
      previousTextRef.current = text;
    }
  }, [text]);

  const setOverride = useCallback((t: InputType) => {
    overrideRef.current = true;
    setType(t);
    setConfidence(1.0);
    setPending(false);
  }, []);

  return { type, confidence, setOverride, pending };
}
