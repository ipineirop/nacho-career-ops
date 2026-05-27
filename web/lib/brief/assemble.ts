/**
 * Brief assembler: the single function that turns a user + a date into the
 * full §3 payload. Composes:
 *   - User identity (locale, timezone, signup date for issue number)
 *   - Computed signals (lib/brief/signals/index.ts) filtered by signal_states
 *   - LLM-generated editor's note + signal bodies (extends evaluate-engine)
 *   - Pipeline summary counts from current pipeline_status rows
 *   - Masthead from signup-based issue number + user-local date + city code
 *
 * Caching: brief_cache holds the full payload per (userId, isoDate). On
 * cache miss, the assembler kicks off generation. The route layer decides
 * whether to block (small payload, no LLM) or background-and-return-pending
 * (LLM call expected).
 */

import { getDb } from '@/lib/db';
import {
  users,
  userLocations,
  pipelineStatus,
  briefCache,
  userEvents,
  type NewBriefCache,
} from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { computeSignals } from './signals';
import { generateBrief, type BriefSignalSeed } from '@/lib/ai/evaluate-engine';
import { issueNumberFor } from './issueNumber';
import { cityCodeFor, cityNameFor } from './cityCode';
import { formatPipelineSentence } from './formatters';
import { resolveActionLabel, snoozeLabelWithDuration } from './i18n';
import type {
  BriefApiResponse,
  BriefMasthead,
  BriefPayload,
  BriefSignalAction,
  BriefSignalPayload,
} from './types';

const TRACKER_LINK = '/tracker';

interface AssembleParams {
  userId: string;
  /** ISO date the Brief is keyed to (user-local). Caller is responsible for
   *  computing this from the user's timezone. */
  isoDate: string;
  /** When true, skip the LLM call and return the pending shape; the caller
   *  is responsible for backgrounding generation via after(). Used on
   *  first-ever views when we want the skeleton to render fast. */
  pendingMode?: boolean;
}

/**
 * Top-level assemble: returns either the resolved §3 payload (cache hit, or
 * fresh generation in non-pending mode) or the pending shape (cache miss in
 * pending mode). The route writes the cache row after generation.
 */
export async function assembleBrief(params: AssembleParams): Promise<BriefApiResponse> {
  const db = getDb();
  const { userId, isoDate, pendingMode = false } = params;

  // Cache hit short-circuits everything.
  const [cached] = await db
    .select()
    .from(briefCache)
    .where(and(eq(briefCache.userId, userId), eq(briefCache.isoDate, isoDate)))
    .limit(1);
  if (cached) {
    return cached.payload as BriefPayload;
  }

  const [user] = await db
    .select({
      id: users.id,
      locale: users.locale,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error(`assembleBrief: user ${userId} not found`);
  }

  const primaryLocale: 'en' | 'es' = (user.locale ?? '').startsWith('en') ? 'en' : 'es';

  // City from current residence (first-3-letter fallback inside cityCodeFor).
  const [residence] = await db
    .select({ city: userLocations.city })
    .from(userLocations)
    .where(
      and(
        eq(userLocations.userId, userId),
        eq(userLocations.locationType, 'current_residence'),
        isNull(userLocations.untilDate),
      ),
    )
    .limit(1);

  const masthead: BriefMasthead = {
    issueNumber: issueNumberFor(user.createdAt ?? null),
    date: isoDate,
    location: cityCodeFor(residence?.city ?? null),
    cityName: cityNameFor(residence?.city ?? null),
    // For pending shape we use "now" so the right-meta still reads
    // sensibly until the real cache row lands and overrides this.
    generatedAt: new Date().toISOString(),
  };

  // First-ever view: return pending, let the route background generation.
  if (pendingMode) {
    return { pending: true, masthead };
  }

  // Compute signals first — they drive the user-context summary the LLM uses.
  const { signals } = await computeSignals(userId);

  // Pipeline summary counts — current rows by status.
  const counts = { reply: 0, pursue: 0, watch: 0 };
  const pipelineRows = await db
    .select({ status: pipelineStatus.status })
    .from(pipelineStatus)
    .where(eq(pipelineStatus.userId, userId));
  for (const r of pipelineRows) {
    if (r.status === 'applied' || r.status === 'interviewing') counts.pursue++;
    else if (r.status === 'evaluating') counts.reply++;
    else if (r.status === 'passed') counts.watch++;
  }
  const pipelineSentence = formatPipelineSentence(counts);

  // Build the LLM seeds. Each signal carries the entityRef/groundingTokens/
  // context the LLM needs to draft body prose without inventing facts.
  const signalSeeds: BriefSignalSeed[] = signals.map((sig) => ({
    id: sig.entityRef,           // entityRef is stable enough to use as id
    type: sig.type,
    groundingTokens: sig.groundingTokens,
    context: sig.context,
  }));

  // Compact user-context summary the LLM uses for the editor's note. Kept
  // factual + structured so the editor doesn't fabricate. The issue
  // number is deliberately excluded — it's masthead chrome, never body
  // copy. Pipeline counts are listed structurally so the LLM can pick
  // which (if any) are newsworthy, but the prompt forbids echoing them
  // as literal prose.
  const signalSummaries = signals.map((s) => {
    const entity =
      (s.context.company_name as string | undefined) ??
      (s.context.role_title as string | undefined) ??
      (s.context.field as string | undefined) ??
      s.entityRef;
    const detail =
      (s.context.days_quiet as number | undefined) !== undefined
        ? `${s.context.days_quiet} days quiet`
        : (s.context.months_stale as number | undefined) !== undefined
        ? `${s.context.months_stale} months stale`
        : '';
    return `- ${s.type}: ${entity}${detail ? ` (${detail})` : ''}`;
  });
  const userContext = [
    `Pipeline counts (data only — do not echo as prose): ` +
      `${counts.pursue} pursues, ${counts.reply} replies, ${counts.watch} watches.`,
    signalSummaries.length > 0
      ? `Signals firing today (use these named entities):\n${signalSummaries.join('\n')}`
      : 'No signals firing today.',
  ].join('\n\n');

  const generated = await generateBrief({
    userId,
    today: isoDate,
    issueNumber: masthead.issueNumber,
    primaryLocale,
    userContext,
    signals: signalSeeds,
    pick: null, // v1: Pick stubbed
  });

  // Record per-user daily LLM cost as a userEvents row (handoff §9.5).
  if (generated.cost.inputTokens > 0 || generated.cost.outputTokens > 0) {
    await db.insert(userEvents).values({
      userId,
      eventType: 'brief.generation_cost',
      eventData: {
        date: isoDate,
        model: generated.cost.model,
        input_tokens: generated.cost.inputTokens,
        output_tokens: generated.cost.outputTokens,
      },
    });
  }

  // Compose signal payloads. Map orchestrator RawSignal × LLM body × i18n
  // action labels into the §3 BriefSignalPayload shape.
  const generatedById = new Map(generated.signals.map((s) => [s.id, s.body]));

  const visibleAll: BriefSignalPayload[] = signals
    .map((sig) => {
      const body = generatedById.get(sig.entityRef);
      if (!body) return null;
      return composeSignalPayload(sig.entityRef, sig, body);
    })
    .filter((x): x is BriefSignalPayload => x !== null);

  const visible = visibleAll.slice(0, 5);
  const collapsed = Math.max(0, visibleAll.length - 5);

  const payload: BriefPayload = {
    pending: false,
    masthead,
    editorsNote: {
      text: generated.editorsNote,
      generationMethod: generated.generationMethod,
    },
    pick: null,
    signals: { visible, collapsed },
    pipelineSummary: {
      sentence: pipelineSentence,
      trackerLink: TRACKER_LINK,
    },
  };

  // Cache for the rest of the user-local day. expiresAt is computed by the
  // route (which knows the timezone); here we pass through a 24h default
  // so the cache table always has a non-null value.
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db
    .insert(briefCache)
    .values({
      userId,
      isoDate,
      payload: payload as unknown as NewBriefCache['payload'],
      expiresAt,
    } as NewBriefCache)
    .onConflictDoNothing();

  return payload;
}

function composeSignalPayload(
  id: string,
  sig: {
    type: BriefSignalPayload['type'];
    kicker: { en: string; es: string };
    actions: {
      primary: { code: string };
      secondary?: { code: string };
      ghost?: { code: 'snooze' | 'dismiss' | 'skip' | 'keep'; durationDays?: number };
    };
  },
  body: { en: string; es: string },
): BriefSignalPayload {
  const primary: BriefSignalAction = {
    code: sig.actions.primary.code,
    label: resolveActionLabel(sig.actions.primary.code),
  };
  const secondary: BriefSignalAction | null = sig.actions.secondary
    ? {
        code: sig.actions.secondary.code,
        label: resolveActionLabel(sig.actions.secondary.code),
      }
    : null;
  const ghost: BriefSignalAction | null = sig.actions.ghost
    ? {
        code: sig.actions.ghost.code,
        // Snooze gets a duration-suffixed label per i18n.ts; other ghosts
        // resolve to plain action codes.
        label: sig.actions.ghost.code === 'snooze' && sig.actions.ghost.durationDays
          ? snoozeLabelWithDuration(sig.actions.ghost.durationDays)
          : resolveActionLabel(sig.actions.ghost.code),
        durationDays: sig.actions.ghost.durationDays,
      }
    : null;

  return {
    id,
    type: sig.type,
    kicker: sig.kicker,
    body,
    actions: { primary, secondary, ghost },
    snoozeUntil: null,
    dismissedAt: null,
  };
}
