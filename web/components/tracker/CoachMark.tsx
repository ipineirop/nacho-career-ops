'use client';

/**
 * Floating callout that points at the FAB on first visit to an empty Tracker.
 * Disappears (unmounts, no fade) the instant the user taps the FAB — the
 * panel opening is the feedback.
 *
 * Positioned 12px above the FAB. Because the FAB sits at:
 *   bottom-[72px]  (mobile/tablet — clears the MobileNav)
 *   lg:bottom-s5   (lg+ — no MobileNav, Sidebar takes over at lg)
 * the coach mark needs matching offsets:
 *   bottom = 72 + 48 (FAB height) + 12 = 132px on mobile/tablet
 *   bottom = 24 + 48 + 12          =  84px on lg+
 *
 * `pointer-events-none` so the coach mark never intercepts taps on the FAB
 * or the Tracker underneath. z-[39] sits below the FAB's z-40 so the FAB
 * paints on top if they ever overlap.
 */
export function CoachMark({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed z-[39] right-s4 lg:right-s5 bottom-[132px] lg:bottom-[84px] pointer-events-none"
    >
      <div className="relative bg-ink text-bg px-s3 py-[10px] rounded-card font-mono text-[11px] uppercase tracking-[0.4px]">
        Start here — paste anything
        {/* Arrow tail: 10×10 square rotated 45°, anchored to bottom-right of
            the bubble so it points down at the FAB. */}
        <span
          aria-hidden="true"
          className="absolute -bottom-[5px] right-[22px] w-[10px] h-[10px] bg-ink rotate-45"
        />
      </div>
    </div>
  );
}
