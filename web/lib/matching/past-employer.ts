// Past-employer matching (spec §3.3 / §3.4 / §3.5 / §2.3).
// Pure function: given a resolved role company and the user's past employers
// (canonical-resolved at CV-parse time), decide whether the role is at a place
// the user already worked, and how.
//
// Surfacing policy (§3.1.1): only HIGH-confidence DIRECT matches surface in v1.
// Acquisition-lineage matches are recorded (matches_user_past_employer = true)
// but kept silent (surface = false) until we have data to graduate them.
// Subsidiary matching defaults to direct only (§3.3) — not handled here.

import { getCanonicalById } from './canonical';
import { resolveCompany, type ResolveResult } from './resolve';

export type MatchRelation = 'direct' | 'acquisition_lineage' | 'subsidiary';

export interface UserEmployer {
  canonical_id: string | null;
  display_name: string;
  startedAt?: string | null; // ISO date or year string
  endedAt?: string | null; // null if current
}

export interface PastEmployerMatch {
  role_company_input: string;
  resolved_canonical_id: string | null;
  resolved_confidence: ResolveResult['resolved_confidence'];
  matches_user_past_employer: boolean;
  surface: boolean;
  matches_via?: {
    past_employer_display: string;
    canonical_id: string;
    date_range: string;
    relation: MatchRelation;
  };
}

function yearOf(d?: string | null): number | null {
  if (!d) return null;
  const m = String(d).match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

function dateRange(e: UserEmployer): string {
  const start = yearOf(e.startedAt);
  const end = e.endedAt ? yearOf(e.endedAt) : null;
  if (start && end) return `${start}–${end}`;
  if (start && !e.endedAt) return `${start}–present`;
  if (start) return `${start}`;
  return '';
}

export function matchPastEmployer(
  resolved: ResolveResult,
  userEmployers: UserEmployer[]
): PastEmployerMatch {
  const base: PastEmployerMatch = {
    role_company_input: resolved.role_company_input,
    resolved_canonical_id: resolved.resolved_canonical_id,
    resolved_confidence: resolved.resolved_confidence,
    matches_user_past_employer: false,
    surface: false,
  };

  if (!resolved.resolved_canonical_id) return base;

  // ── Direct match (§3.5a) ─────────────────────────────────────────
  const direct = userEmployers.find((e) => e.canonical_id === resolved.resolved_canonical_id);
  if (direct) {
    return {
      ...base,
      matches_user_past_employer: true,
      // §3.1.1: only high-confidence direct matches surface in v1.
      surface: resolved.resolved_confidence === 'high',
      matches_via: {
        past_employer_display: direct.display_name,
        canonical_id: resolved.resolved_canonical_id,
        date_range: dateRange(direct),
        relation: 'direct',
      },
    };
  }

  // ── Acquisition lineage (§3.4) ───────────────────────────────────
  // The role's canonical record may list what it absorbed. If the user worked
  // at that absorbed company *during or before* the acquisition year, connect.
  const roleRecord = getCanonicalById(resolved.resolved_canonical_id);
  for (const lin of roleRecord?.acquisition_lineage ?? []) {
    const wasCanonical = resolveCompany(lin.was).resolved_canonical_id;
    if (!wasCanonical) continue;
    const emp = userEmployers.find((e) => e.canonical_id === wasCanonical);
    if (!emp) continue;
    const endYear = yearOf(emp.endedAt);
    // §3.4: surface if the user was there during/before acquisition. CV dates
    // are often year-only — on a boundary-year tie, lean toward acknowledging.
    if (endYear === null || endYear <= lin.until) {
      return {
        ...base,
        matches_user_past_employer: true,
        // §3.1.1: acquisition-lineage matches are logged but stay silent in v1.
        surface: false,
        matches_via: {
          past_employer_display: emp.display_name,
          canonical_id: wasCanonical,
          date_range: dateRange(emp),
          relation: 'acquisition_lineage',
        },
      };
    }
  }

  return base;
}
