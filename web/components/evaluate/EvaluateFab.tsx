'use client';

import { usePathname } from 'next/navigation';
import { useEvaluatePanel } from './EvaluatePanelProvider';

/**
 * Persistent FAB that opens the Evaluate panel. Mounted at the app root so
 * it's available on every route, hidden contextually:
 *   • Returns null on /onboarding/* — the FAB doesn't belong in the onboarding flow.
 *   • Fades out (aria-hidden, no pointer events) when the panel is already open.
 *
 * Visual: square 48×48 pill on mobile (L mark only); 48-tall pill on desktop
 * with the "Evaluate" label. No shadow (Rule 03). Only `accent` is chromatic.
 */
export function EvaluateFab() {
  const pathname = usePathname();
  const { isOpen, open, pulseOnFirstVisit } = useEvaluatePanel();

  if (pathname?.startsWith('/onboarding')) return null;

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Evaluate"
      aria-hidden={isOpen || undefined}
      tabIndex={isOpen ? -1 : 0}
      // Mobile: 48×48 circle, label hidden. Desktop: 48-tall pill with label.
      // The bottom MobileNav (56px) is visible at any viewport < lg, so the FAB
      // sits at `bottom: 72px` (56 nav + 16 gap) until lg, then drops to s5 = 24px
      // alongside the Sidebar. Per Rule 03: no shadow.
      className={[
        'fixed bottom-[72px] right-s4 lg:bottom-s5 lg:right-s5 z-40',
        'h-s7 w-s7 md:w-auto md:px-s4',
        'inline-flex items-center justify-center md:justify-start',
        'bg-accent hover:bg-accent-h text-accent-on',
        'rounded-pill border-0 cursor-pointer',
        'transition-opacity duration-200',
        isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100',
        // Post-onboarding teaching moment: 2 pulses, then never (provider's
        // hasOpenedThisSession + Tracker's coachMarkDismissed prevent re-fire).
        pulseOnFirstVisit && !isOpen ? 'fab-pulse' : '',
      ].join(' ')}
    >
      {/* L mark — Fraunces 500 22px, with italic period rendered separately so
          it can be sized/italicized independently per the design. */}
      <span className="font-serif font-medium text-[22px] leading-none">
        L<span className="italic text-[16px]">.</span>
      </span>
      <span className="hidden md:inline ml-s2 font-body font-semibold text-[14px] -tracking-[0.1px] pr-s2">
        Evaluate
      </span>
    </button>
  );
}
