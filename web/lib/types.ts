export interface Application {
  id: number;
  date: string;
  company: string;
  role: string;
  score: string;
  scoreNum: number;
  status: string;
  hasPdf: boolean;
  reportId: string | null;
  notes: string;
}

export interface PipelineJob {
  url: string;
  company: string;
  role: string;
  checked: boolean;
  evalId: string | null;
  score: string | null;
  hasPdf: boolean | null;
  rawLine: string;
}

export interface Report {
  id: string;
  slug: string;
  date: string;
  filename: string;
  path: string;
}

export const CANONICAL_STATUSES = [
  'Evaluated',
  'Applied',
  'Responded',
  'Interview',
  'Offer',
  'Rejected',
  'Discarded',
  'SKIP',
] as const;

export type CanonicalStatus = typeof CANONICAL_STATUSES[number];
