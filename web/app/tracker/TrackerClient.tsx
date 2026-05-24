'use client';

import { useEffect, useState } from 'react';
import { useEvaluatePanel } from '@/components/evaluate/EvaluatePanelProvider';
import { CoachMark } from '@/components/tracker/CoachMark';

/**
 * Mounted on Tracker only. Owns the post-onboarding teaching moment:
 *   • Sets `pulseOnFirstVisit` on the panel provider so the FAB pulses (twice,
 *     by CSS animation) when this is the user's first visit.
 *   • Renders the CoachMark callout above the FAB until the user taps it.
 *   • Registers an `onFirstOpen` callback that fires the first time the panel
 *     opens this session — POSTs the dismissal endpoint and locally hides the
 *     coach mark + pulse so the page reflects the change immediately (without
 *     waiting for the server roundtrip).
 *
 * On unmount (user navigates away from Tracker), the state is cleared so the
 * pulse / callback don't leak into Settings or other surfaces.
 */
export function TrackerClient({ firstVisit }: { firstVisit: boolean }) {
  const { setPulseOnFirstVisit, setOnFirstOpen } = useEvaluatePanel();
  // Local mirror so we can hide the coach mark + pulse the instant the FAB is
  // tapped, without waiting for the API roundtrip.
  const [stillCoaching, setStillCoaching] = useState(firstVisit);

  useEffect(() => {
    if (!firstVisit) {
      setPulseOnFirstVisit(false);
      setOnFirstOpen(null);
      return;
    }

    setPulseOnFirstVisit(true);
    setOnFirstOpen(() => {
      // Optimistic UI: drop the pulse + coach mark first, then persist.
      setStillCoaching(false);
      setPulseOnFirstVisit(false);
      // Fire-and-forget. If the network fails, the user will see the coach
      // mark next session — annoying but not broken; v1 trade-off.
      fetch('/api/preferences/coach-mark-dismissed', { method: 'POST' }).catch(() => {});
    });

    return () => {
      setPulseOnFirstVisit(false);
      setOnFirstOpen(null);
    };
  }, [firstVisit, setPulseOnFirstVisit, setOnFirstOpen]);

  return <CoachMark visible={stillCoaching} />;
}
