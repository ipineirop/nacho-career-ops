// Company-name normalization for canonical matching (spec §3.2).
// Applied to both the input string and (at load time) every alias / lineage
// name in the canonical table. Two normalized forms are compared for equality.

// Known trailing suffixes to strip, in already-normalized form (lowercased,
// punctuation removed). Multi-word phrases are matched as trailing token runs.
// NOTE: business-line tokens (pay, capital, ventures, labs) are intentionally
// NOT here — they denote distinct entities the canonical table distinguishes.
const SUFFIX_PHRASES: string[] = [
  // Corporate
  'inc',
  'sa',
  's a',
  'sa de cv',
  's a de c v',
  'ltd',
  'llc',
  'gmbh',
  'bv',
  'plc',
  // Geographic
  'mexico',
  'colombia',
  'brasil',
  'brazil',
  'argentina',
  'chile',
  'peru',
  'latam',
  'latinoamerica',
  'usa',
  'us',
];

const SUFFIX_SET = new Set(SUFFIX_PHRASES);
const MAX_SUFFIX_TOKENS = Math.max(...SUFFIX_PHRASES.map((p) => p.split(' ').length));

/**
 * Normalize a company name for equality comparison.
 * Order matters (spec §3.2):
 *   1. lowercase
 *   2. strip diacritics (méxico → mexico)
 *   3. remove punctuation except intra-name hyphens
 *   4. collapse whitespace
 *   5. strip known trailing suffixes (revert if it would empty the string)
 *   6. trim
 */
export function normalizeCompany(input: string): string {
  if (!input) return '';

  let s = input.toLowerCase();

  // 2. strip diacritics
  s = s.normalize('NFD').replace(/\p{Diacritic}/gu, '');

  // 3. remove punctuation except hyphens; turn separators into spaces
  s = s.replace(/[^\p{L}\p{N}\s-]/gu, ' ');

  // 4. collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();

  // 5. strip trailing suffix phrases, greedily longest-first, looping so
  //    chained suffixes ("rappi inc mexico") are both removed.
  let tokens = s.split(' ').filter(Boolean);
  for (;;) {
    let stripped = false;
    for (let len = Math.min(MAX_SUFFIX_TOKENS, tokens.length - 1); len >= 1; len--) {
      const candidate = tokens.slice(-len).join(' ');
      if (!SUFFIX_SET.has(candidate)) continue;
      const remaining = tokens.slice(0, tokens.length - len);
      // revert-if-empty edge: don't strip down to empty or a single char
      if (remaining.join(' ').length <= 1) break;
      tokens = remaining;
      stripped = true;
      break;
    }
    if (!stripped) break;
  }

  // 6. trim
  return tokens.join(' ').trim();
}
