/**
 * §3 payload shape from `Labra Brief - code handoff.md`. This is what
 * `GET /api/brief` returns when the Brief is ready (i.e., not `pending`).
 *
 * Every LLM-generated text field is the bilingual `{ en, es }` shape;
 * static labels (the ones in `lib/brief/i18n.ts`) follow the same shape so
 * the client picks `text[user.locale]` uniformly at render time.
 *
 * The Pick is always `null` in v1 per the plan, but the type is kept full
 * so the UI component is ready when the Pick source lands.
 */

export type Bilingual = { en: string; es: string };

export interface BriefMasthead {
  issueNumber: number;
  date: string;      // ISO date (YYYY-MM-DD); client formats per locale
  location: string;  // 3-letter city code; never translated
  /** Full city name in source language, used in the right-meta block
   *  (e.g. "Mexico City"). Falls back to the code if unknown. */
  cityName: string;
  /** ISO datetime the cache row was generated. The client computes
   *  "LAST REFRESH · X MIN" relative to its own clock. */
  generatedAt: string;
}

export interface BriefEditorsNote {
  text: Bilingual;
  generationMethod: 'llm' | 'fallback';
}

export interface BriefSalaryEstimate {
  bandLow: number;
  bandHigh: number;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
  floor: number;
}

export interface BriefPick {
  score: number;
  kicker: Bilingual;
  headline: Bilingual;
  subhead: Bilingual;
  companyMeta: {
    name: string;
    avatar: string | null;
    role: string;
    location: string;
    workModel: 'remote' | 'hybrid' | 'onsite';
    segment: string;
  };
  salaryEstimate: BriefSalaryEstimate;
  hiringManager: null | {
    name: string;
    prior: string[];
    mutualCount: number;
  };
  editorialSummary: Bilingual;
  actions: string[];   // action codes; client resolves via i18n catalog
}

export interface BriefSignalAction {
  code: string;
  label: Bilingual;
  durationDays?: number;
}

export interface BriefSignalPayload {
  id: string;
  type: 'freshness' | 'drift' | 'bar' | 'pipeline.cold' | 'pipeline.next';
  kicker: Bilingual;
  body: Bilingual;
  actions: {
    primary: BriefSignalAction;
    secondary: BriefSignalAction | null;
    ghost: BriefSignalAction | null;
  };
  snoozeUntil: string | null;   // ISO datetime, mirrored from signal_states
  dismissedAt: string | null;
}

export interface BriefPipelineSummary {
  sentence: Bilingual;
  trackerLink: string;
}

export interface BriefPayload {
  pending: false;
  masthead: BriefMasthead;
  editorsNote: BriefEditorsNote;
  pick: BriefPick | null;
  signals: {
    visible: BriefSignalPayload[];   // max 5
    collapsed: number;
  };
  pipelineSummary: BriefPipelineSummary;
}

/**
 * Pending response — sent only on a user's first-ever view of the day when
 * the assembler kicked off generation via `after()` and the cache row
 * hasn't landed yet. Client renders the skeleton screen state and polls.
 */
export interface BriefPendingPayload {
  pending: true;
  masthead: BriefMasthead;   // masthead renders immediately (no LLM dep)
}

export type BriefApiResponse = BriefPayload | BriefPendingPayload;
