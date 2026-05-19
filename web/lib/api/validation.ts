import { z } from 'zod';

// Canonical status values
export const PIPELINE_STATUS = {
  evaluating: 'evaluating',
  applied: 'applied',
  interviewing: 'interviewing',
  offer: 'offer',
  accepted: 'accepted',
  rejected: 'rejected',
  withdrawn: 'withdrawn',
  passed: 'passed',
} as const;

export type PipelineStatus = typeof PIPELINE_STATUS[keyof typeof PIPELINE_STATUS];

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
