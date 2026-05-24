'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Single source of truth for the Evaluate panel's open/close state, plus the
 * post-onboarding teaching-moment hooks that the Tracker first-visit flow
 * registers:
 *   • `pulseOnFirstVisit` — the FAB reads this and applies the pulse animation
 *     when true. Tracker sets it true on first visit, false otherwise.
 *   • `setOnFirstOpen(cb)` — registers a callback fired exactly once, on the
 *     very first call to `open()` per session. Tracker uses it to POST the
 *     dismissal endpoint and locally hide the coach mark + pulse.
 *
 * Mounted once at the root in app/layout.tsx.
 */
interface EvaluatePanelContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  pulseOnFirstVisit: boolean;
  setPulseOnFirstVisit: (on: boolean) => void;
  setOnFirstOpen: (cb: (() => void) | null) => void;
}

const EvaluatePanelContext = createContext<EvaluatePanelContextValue | null>(null);

export function EvaluatePanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pulseOnFirstVisit, setPulseOnFirstVisitState] = useState(false);
  const onFirstOpenRef = useRef<(() => void) | null>(null);
  const hasOpenedThisSessionRef = useRef(false);

  const open = useCallback(() => {
    setIsOpen(true);
    if (!hasOpenedThisSessionRef.current) {
      hasOpenedThisSessionRef.current = true;
      const cb = onFirstOpenRef.current;
      if (cb) {
        try { cb(); } catch (err) { console.error('onFirstOpen callback failed', err); }
      }
    }
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const setOnFirstOpen = useCallback((cb: (() => void) | null) => {
    onFirstOpenRef.current = cb;
  }, []);

  const setPulseOnFirstVisit = useCallback((on: boolean) => {
    setPulseOnFirstVisitState(on);
  }, []);

  const value = useMemo<EvaluatePanelContextValue>(
    () => ({ isOpen, open, close, pulseOnFirstVisit, setPulseOnFirstVisit, setOnFirstOpen }),
    [isOpen, open, close, pulseOnFirstVisit, setPulseOnFirstVisit, setOnFirstOpen],
  );

  return <EvaluatePanelContext.Provider value={value}>{children}</EvaluatePanelContext.Provider>;
}

export function useEvaluatePanel(): EvaluatePanelContextValue {
  const ctx = useContext(EvaluatePanelContext);
  if (!ctx) {
    throw new Error('useEvaluatePanel must be used inside <EvaluatePanelProvider>');
  }
  return ctx;
}
