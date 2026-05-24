/**
 * Match the route shell so the server-render → client-hydration handoff is
 * silent. No spinner per spec — only the kicker header to hold the chrome.
 */
export default function Loading() {
  return (
    <div className="max-w-[720px] px-s5 py-s6 flex flex-col gap-s4">
      <span className="font-mono text-[11px] uppercase tracking-[0.4px] text-ink-3">Evaluate</span>
    </div>
  );
}
