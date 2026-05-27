/**
 * Deterministic fallback templates per `Labra Brief - code handoff.md` §5.4.
 *
 * The fallback fires when the LLM regeneration loop (generate → lint → retry
 * once with stricter prompt → fall back) rejects twice. The result is
 * visually identical to a live editor's note — same Fraunces typography, same
 * width, same line count — so the user can't tell which path produced it.
 *
 * The templates are inherently grounded (they reference the issue number and
 * a signal count), so callers can lint them with an empty `groundingTokens`
 * array and they pass cleanly.
 */

export interface FallbackEditorsNoteParams {
  issueNumber: number;
  signalCount: number;
}

export function buildFallbackEditorsNote(
  params: FallbackEditorsNoteParams,
): { en: string; es: string } {
  const { issueNumber, signalCount } = params;
  return {
    // Handoff §5.4 — the literal template strings, parameterized.
    en: `№ ${issueNumber}. ${signalCount} on the table today.`,
    es: `№ ${issueNumber}. ${signalCount} en juego hoy.`,
  };
}
