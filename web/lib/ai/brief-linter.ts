/**
 * Brief content linter — enforces the post-generation rules in
 * `web/Design/Labra Brief - code handoff.md` §5.3 before any LLM-generated
 * text is shown to the user or cached.
 *
 * The linter is intentionally a pure function with no I/O. Tests live next to
 * it at `brief-linter.test.ts` and cover every rule below.
 *
 * Rules (each applies to both EN and ES unless noted):
 *   - Banlist phrases (per language, see BANLIST_EN / BANLIST_ES below)
 *   - Any emoji
 *   - Any exclamation mark (`!` or `¡`)
 *   - Em-dash `—` — ES only (handoff §17.1: Spanish bans em-dashes)
 *   - More than 3 sentences
 *   - More than 1 italicized span (single-star `*…*` markdown)
 *   - The standalone token `JD` (case-insensitive) — recruiter jargon, v3 addition
 *   - Grounding: must reference at least one entity name or count from the
 *     source data. The caller supplies `groundingTokens`; the body must contain
 *     at least one (case-insensitive substring match).
 *
 * Returns `{ ok: true }` or `{ ok: false, reasons: [...] }`. The generator
 * uses `reasons` to drive the regenerate-once-then-fallback flow (handoff
 * §5.1 / §5.4).
 */

export type BriefLintLanguage = 'en' | 'es';

export interface BriefLintOptions {
  language: BriefLintLanguage;
  /** Tokens from the source data the body must reference. Substring match,
   *  case-insensitive. Pass entity names and stringified counts (e.g.
   *  ['Mercado Libre', 'Kavak', '3', '7d']). Empty array disables the
   *  grounding check (use only for fallback templates that are inherently
   *  grounded). */
  groundingTokens: string[];
}

export type BriefLintReason =
  | 'banlist_phrase'
  | 'emoji'
  | 'exclamation'
  | 'em_dash_es'
  | 'too_many_sentences'
  | 'too_many_italics'
  | 'jd_jargon'
  | 'ungrounded';

export interface BriefLintFinding {
  reason: BriefLintReason;
  detail: string;
}

export type BriefLintResult =
  | { ok: true }
  | { ok: false; findings: BriefLintFinding[] };

// ---------------------------------------------------------------------------
// Banlists — handoff §5.5. Match case-insensitively as whole phrases.
// ---------------------------------------------------------------------------

const BANLIST_EN: readonly string[] = [
  // Gamification / superlatives
  'amazing', 'incredible', 'spectacular', 'extraordinary',
  // Urgency / scarcity
  "don't miss out", 'last chance', 'exclusive', 'limited time',
  // Sales CTAs
  'next level', 'take the next step', 'apply now', 'act now',
  // "We" as product
  'we found', 'we bring you', 'we offer',
];

const BANLIST_ES: readonly string[] = [
  // Gamificación / superlativos
  'increíble', 'asombroso', 'espectacular', 'fantástico', 'extraordinario',
  // Urgencia / escasez
  'no te lo pierdas', 'imperdible', 'última oportunidad', 'oportunidad única',
  // CTAs de venta
  'lleva tu carrera al siguiente nivel', 'da el siguiente paso',
  'transforma tu carrera', 'actúa ahora', 'aplica ya', 'no esperes más',
  // "Nosotros" como producto — note: standalone `encontramos` in editorial
  // commentary is allowed (handoff §5.5 special case); only the
  // product-voice constructions below are banned.
  'te encontramos', 'encontramos para ti', 'te traemos', 'te ofrecemos',
  // Exclusivo when used to manufacture scarcity. We keep this conservative
  // and ban any occurrence; if a legitimate use case appears, narrow later.
  'exclusivo', 'exclusiva',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Bold (`**foo**`) and italic (`*foo*`) markdown spans. The DS v2 voice
 *  rules allow unlimited bolds (entity highlighting) but cap italics at
 *  one per language. We strip BOTH before sentence counting and count
 *  ONLY italics for the cap. */
const BOLD_RE = /\*\*([^*\n]+)\*\*/g;
const ITALIC_RE = /(^|[^*])\*([^*\n]+)\*(?!\*)/g;

/** Emoji detection. Covers the major Unicode emoji blocks Anthropic models
 *  actually produce in editorial text: pictographs, symbols, dingbats,
 *  flags. We deliberately err toward inclusive: the Brief surface should
 *  never have emoji of any kind. */
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

/** Standalone `JD` token, case-insensitive — matches at word boundaries so
 *  legitimate words like "judo" or "BDR" are safe. Catches `JD`, `jd`, `Jd`. */
const JD_TOKEN_RE = /\bjd\b/i;

/** Approximate sentence count — splits on `.`, `?`, or Spanish `¿…?` /
 *  exclamation analogs after stripping italic + bold markers. Good enough
 *  to catch "too long" without needing a full NLP tokenizer. */
function countSentences(text: string): number {
  // Strip **bold** then *italic* (in that order — bold first so its `**`
  // stars don't masquerade as italic delimiters).
  const stripped = text
    .replace(BOLD_RE, '$1')
    .replace(ITALIC_RE, '$1$2')
    .trim();
  if (!stripped) return 0;
  // Split on terminal punctuation followed by space-or-end. We also count
  // bare-newline-separated lines as sentences for safety (the handoff voice
  // says 1–3 sentences, never multi-paragraph).
  const parts = stripped
    .split(/[.?!]+(?:\s|$)|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length;
}

function lowercaseHasPhrase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function lintBriefText(text: string, options: BriefLintOptions): BriefLintResult {
  const findings: BriefLintFinding[] = [];
  const banlist = options.language === 'es' ? BANLIST_ES : BANLIST_EN;

  // 1. Banlist phrases
  for (const phrase of banlist) {
    if (lowercaseHasPhrase(text, phrase)) {
      findings.push({ reason: 'banlist_phrase', detail: phrase });
    }
  }

  // 2. Emoji
  if (EMOJI_RE.test(text)) {
    findings.push({ reason: 'emoji', detail: 'emoji detected' });
  }

  // 3. Exclamation marks (! or ¡, either language)
  if (/[!¡]/.test(text)) {
    findings.push({ reason: 'exclamation', detail: 'exclamation mark detected' });
  }

  // 4. Em-dash — ES only
  if (options.language === 'es' && text.includes('—')) {
    findings.push({ reason: 'em_dash_es', detail: 'em-dash forbidden in Spanish' });
  }

  // 5. Sentence count
  const sentenceCount = countSentences(text);
  if (sentenceCount > 3) {
    findings.push({
      reason: 'too_many_sentences',
      detail: `${sentenceCount} sentences (max 3)`,
    });
  }

  // 6. Italic spans — bold spans (`**…**`) are unlimited and don't count.
  // We strip bold first so its `**` doesn't masquerade as italic
  // delimiters, then count the remaining `*…*` runs.
  const italicScan = text.replace(BOLD_RE, ' ');
  const italicMatches = italicScan.match(/\*[^*\n]+\*/g);
  if (italicMatches && italicMatches.length > 1) {
    findings.push({
      reason: 'too_many_italics',
      detail: `${italicMatches.length} italic spans (max 1)`,
    });
  }

  // 7. JD jargon
  if (JD_TOKEN_RE.test(text)) {
    findings.push({ reason: 'jd_jargon', detail: 'standalone JD token forbidden' });
  }

  // 8. Grounding — must reference a source-data entity or count
  if (options.groundingTokens.length > 0) {
    const lower = text.toLowerCase();
    const grounded = options.groundingTokens.some((t) => {
      const tok = t.trim().toLowerCase();
      return tok.length > 0 && lower.includes(tok);
    });
    if (!grounded) {
      findings.push({
        reason: 'ungrounded',
        detail: 'no source-data entity or count referenced',
      });
    }
  }

  return findings.length === 0 ? { ok: true } : { ok: false, findings };
}

/** Bilingual convenience: lint both versions, return findings keyed by
 *  language. Either-side failure makes the overall result `ok: false`. */
export function lintBriefBilingual(
  text: { en: string; es: string },
  groundingTokens: string[],
):
  | { ok: true }
  | { ok: false; en: BriefLintFinding[]; es: BriefLintFinding[] } {
  const en = lintBriefText(text.en, { language: 'en', groundingTokens });
  const es = lintBriefText(text.es, { language: 'es', groundingTokens });
  if (en.ok && es.ok) return { ok: true };
  return {
    ok: false,
    en: en.ok ? [] : en.findings,
    es: es.ok ? [] : es.findings,
  };
}

// Exported for tests + the generator's stricter-retry prompt construction.
export const __internals = { BANLIST_EN, BANLIST_ES, countSentences };
