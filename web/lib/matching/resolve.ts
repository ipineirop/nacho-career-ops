// Company resolution pipeline (spec §3.1).
// normalize → alias-table lookup (high) → acquisition-lineage lookup (medium)
// → no resolution (null). LLM fallback is deferred (§3.1 / §7) — stubbed below.

import { normalizeCompany } from './normalize';
import { lookupByAlias, lookupByLineage } from './canonical';

export type Confidence = 'high' | 'medium' | 'low';
export type ResolvedConfidence = Confidence | 'none';
export type ResolveMethod = 'alias_table' | 'acquisition_lineage' | 'none';

export interface MatchAttempt {
  method: ResolveMethod;
  candidate_canonical_id: string | null;
  confidence: Confidence;
}

export interface ResolveResult {
  role_company_input: string;
  normalized: string;
  resolved_canonical_id: string | null;
  resolved_confidence: ResolvedConfidence;
  match_attempts: MatchAttempt[];
}

export function resolveCompany(input: string): ResolveResult {
  const normalized = normalizeCompany(input);
  const match_attempts: MatchAttempt[] = [];

  if (!normalized) {
    return {
      role_company_input: input,
      normalized,
      resolved_canonical_id: null,
      resolved_confidence: 'none',
      match_attempts,
    };
  }

  // 1. alias table — exact match against any normalized alias → high
  const aliasHit = lookupByAlias(normalized);
  if (aliasHit) {
    match_attempts.push({ method: 'alias_table', candidate_canonical_id: aliasHit, confidence: 'high' });
    return {
      role_company_input: input,
      normalized,
      resolved_canonical_id: aliasHit,
      resolved_confidence: 'high',
      match_attempts,
    };
  }
  match_attempts.push({ method: 'alias_table', candidate_canonical_id: null, confidence: 'low' });

  // 2. acquisition lineage — input is what a company used to be called → medium
  const lineageHits = lookupByLineage(normalized);
  if (lineageHits.length > 0) {
    const successor = lineageHits[0].canonical_id;
    match_attempts.push({
      method: 'acquisition_lineage',
      candidate_canonical_id: successor,
      confidence: 'medium',
    });
    return {
      role_company_input: input,
      normalized,
      resolved_canonical_id: successor,
      resolved_confidence: 'medium',
      match_attempts,
    };
  }

  // 3. no resolution
  match_attempts.push({ method: 'none', candidate_canonical_id: null, confidence: 'low' });
  return {
    role_company_input: input,
    normalized,
    resolved_canonical_id: null,
    resolved_confidence: 'none',
    match_attempts,
  };
}

/**
 * Deferred (spec §3.1 / §7): LLM-mediated fallback for company strings the
 * alias/lineage tables can't resolve. Interface stubbed so it can drop in later.
 */
export async function resolveCompanyLLM(
  _input: string,
  _userEmployerList: string[]
): Promise<{ canonical_id: string | null; confidence: ResolvedConfidence }> {
  return { canonical_id: null, confidence: 'none' };
}
