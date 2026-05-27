import { z } from 'zod';

/**
 * Canonical pipeline-status taxonomy (DS §11 v3).
 *
 * Four active states + five terminal states. The DB enforces this set via
 * a CHECK constraint added in migration 0014; this zod enum is the
 * client-facing gate.
 *
 * The keys here are the internal codes — the same strings written to
 * pipeline_status.status. Bilingual display labels live in
 * `web/lib/brief/i18n.ts` under STATUS_LABELS (added by Phase 3).
 */
export const PIPELINE_STATUS = {
  // active phase
  evaluating: 'evaluating',
  applied: 'applied',
  interviewing: 'interviewing',
  offer_pending: 'offer_pending',
  // terminal phase
  offer_accepted: 'offer_accepted',
  rejected: 'rejected',
  withdrew: 'withdrew',
  passed: 'passed',
  ghosted: 'ghosted',
} as const;

export type PipelineStatus = typeof PIPELINE_STATUS[keyof typeof PIPELINE_STATUS];

/** Active subset — used by the Tracker "active only" toggle and by Way-A
 *  triggers that only fire on in-flight roles. */
export const ACTIVE_PIPELINE_STATUSES: ReadonlyArray<PipelineStatus> = [
  'evaluating',
  'applied',
  'interviewing',
  'offer_pending',
];

/** Terminal subset — surfaces in the closed-30d group below the active rows. */
export const TERMINAL_PIPELINE_STATUSES: ReadonlyArray<PipelineStatus> = [
  'offer_accepted',
  'rejected',
  'withdrew',
  'passed',
  'ghosted',
];

export function isTerminalStatus(s: string): s is PipelineStatus {
  return (TERMINAL_PIPELINE_STATUSES as ReadonlyArray<string>).includes(s);
}

export function isActiveStatus(s: string): s is PipelineStatus {
  return (ACTIVE_PIPELINE_STATUSES as ReadonlyArray<string>).includes(s);
}

// Request validation schemas
export const updatePipelineStatusSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
  status: z.enum(Object.values(PIPELINE_STATUS) as [string, ...string[]]),
  appliedAt: z.string().datetime().optional(),
  notesMarkdown: z.string().max(5000).optional(),
  followUpDueAt: z.string().datetime().optional(),
});

export const searchOpportunitiesSchema = z.object({
  q: z.string().max(200).optional(),
  domain: z.string().optional(),
  location: z.string().optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  minCompUsd: z.coerce.number().optional(),
  maxCompUsd: z.coerce.number().optional(),
  remotePolicy: z.enum(['remote', 'hybrid', 'onsite']).optional(),
  seniorityLevel: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * `outcome_type` is a separate enum (the captured offer/rejection record),
 * intentionally NOT renamed in lockstep with the pipeline-status migration.
 * The wiring doc keeps `ghost` here to avoid a redundant rename.
 */
export const createOutcomeSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
  outcomeType: z.enum(['offer', 'rejection', 'ghost', 'withdrawn', 'accepted', 'negotiated']),
  offerBaseUsd: z.coerce.number().optional(),
  offerTotalUsd: z.coerce.number().optional(),
  offerCurrency: z.string().optional(),
  negotiatedDeltaPct: z.coerce.number().optional(),
  rejectionReason: z.string().optional(),
  notesMarkdown: z.string().max(5000).optional(),
});

export type UpdatePipelineStatusInput = z.infer<typeof updatePipelineStatusSchema>;
export type SearchOpportunitiesInput = z.infer<typeof searchOpportunitiesSchema>;
export type CreateOutcomeInput = z.infer<typeof createOutcomeSchema>;
