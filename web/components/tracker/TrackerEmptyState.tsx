/**
 * Editorial empty state for Tracker — the explicit teach on first visit.
 * No CTA inside the block; the CTA is the FAB. Adding a second button would
 * split the user's attention away from the FAB and break the teaching signal.
 *
 * The period in "Paste your first one." is rendered in accent italic to
 * match the brand wordmark treatment ("labra.").
 */
export function TrackerEmptyState() {
  return (
    <div className="py-s7">
      <h2 className="font-serif font-medium text-[28px] leading-[1.2] -tracking-[0.4px] text-ink mb-s3">
        Paste your first one<span className="text-accent italic">.</span>
      </h2>
      <p className="font-body text-[14px] text-ink-2 leading-[1.6] max-w-[420px]">
        A recruiter message, a job description, or a link. Labra returns an honest read — verdict, fit, comp signal — in about thirty seconds.
      </p>
    </div>
  );
}
