import type { VerdictMeta } from '@/components/evaluations/VerdictSurfaces';

export type Verdict = 'reply' | 'pursue' | 'watch' | 'skip';
export type Legitimacy = 'High Confidence' | 'Proceed with Caution' | 'Suspicious';

export interface CompStrip {
  state: 'amber' | 'ok' | 'positive';
  rangeLabel: string;
  gradeLabel: string;
  gradeDots: string;
  vintage: string;
  word: string;
  gloss: string;
  floorValue: number;
  ceilingValue: number;
  markValue: number;
  markPct: number;
  markLabel: string;
  statusGlyph: string;
  statusText: string;
  actionGlyph: string;
  actionText: string;
  source: string;
}

export interface VerdictPayload {
  verdict: Verdict;
  score: number;
  reasoningLede: string;
  reasoningBody: string;
  gaps: Array<{ text: string; severity: 'hard' | 'soft' }>;
  comp: CompStrip | null;
  legitimacy: Legitimacy;
  patternHits: string[];
}

export interface RoleSummary {
  company: string;
  title: string;
  location: string;
  remotePolicy: string;
  seniority: string;
  sourceLabel: string; // "job posting" | "message"
  url: string | null;
}

// The full LABRA_META trailer: the past-employer/pattern surfaces (VerdictMeta)
// plus the editorial verdict payload, the report link, and role facts.
export interface FullVerdictMeta extends VerdictMeta {
  displayId?: string;
  verdict?: VerdictPayload;
  role?: RoleSummary;
}

// Verdict word → display label + per-verdict primary action.
export const VERDICT_LABEL: Record<Verdict, string> = {
  reply: 'Reply',
  pursue: 'Pursue',
  watch: 'Watch',
  skip: 'Skip',
};
