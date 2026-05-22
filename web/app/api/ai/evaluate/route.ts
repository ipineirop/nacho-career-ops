import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { evaluateRole } from '@/lib/ai/evaluate-engine';
import { UnauthorizedError, ValidationError, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/api/logger';
import { getDb, evaluations, userCareerHistory, roles } from '@/lib/db';
import { eq, gte, and } from 'drizzle-orm';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    // Rate limiting: 10 evaluations per user per hour
    const db = getDb();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEvals = await db
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(
        and(
          eq(evaluations.userId, authUser.id),
          gte(evaluations.evaluatedAt, oneHourAgo)
        )
      )
      .limit(10);

    if (recentEvals.length >= 10) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded: 10 evaluations per hour' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { jd, url, source } = await req.json();
    if (!jd || !jd.trim()) {
      throw new ValidationError('A role, posting, or message is required');
    }

    logger.info('Evaluation request received', { userId: authUser.id, hasUrl: !!url, source });

    // Run the canonical (modes-driven) evaluation
    const result = await evaluateRole({
      jd: jd.trim(),
      url,
      userId: authUser.id,
      source,
    });

    // Build streaming response. The body IS the canonical A–G report (the
    // "working" view streams it; /reports/[id] renders the same markdown).
    const encoder = new TextEncoder();
    const chunks = [result.reportMarkdown.endsWith('\n') ? result.reportMarkdown : `${result.reportMarkdown}\n`];

    // Structured trailer (parsed + stripped by the client) — carries the
    // editorial verdict payload and the interactive surfaces that don't belong
    // in the markdown body: the past-employer match record (§3.5a/§5.1), pattern
    // hits (§3.5b), and the user's past employers for the §5.2 picker.
    const pastEmployers = await db
      .select({
        canonicalId: userCareerHistory.canonicalId,
        companyName: userCareerHistory.companyName,
        startedAt: userCareerHistory.startedAt,
        endedAt: userCareerHistory.endedAt,
      })
      .from(userCareerHistory)
      .where(eq(userCareerHistory.userId, authUser.id));

    // Role facts for the verdict summary header (Company · Location · Mode · Source).
    const roleRow = (await db
      .select({
        companyName: roles.companyName,
        roleTitle: roles.roleTitle,
        location: roles.location,
        remotePolicy: roles.remotePolicy,
        seniorityLevel: roles.seniorityLevel,
      })
      .from(roles)
      .where(eq(roles.id, result.roleId))
      .limit(1))[0];

    const sourceLabel = source === 'dm' ? 'message' : 'job posting';

    const meta = {
      evaluationId: result.evaluationId,
      roleId: result.roleId,
      displayId: result.displayId,
      verdict: result.payload, // editorial verdict (hero/comp/gaps)
      role: {
        company: roleRow?.companyName ?? '',
        title: roleRow?.roleTitle ?? '',
        location: roleRow?.location ?? '',
        remotePolicy: roleRow?.remotePolicy ?? '',
        seniority: roleRow?.seniorityLevel ?? '',
        sourceLabel,
        url: url ?? null,
      },
      pastEmployerMatch: result.pastEmployerMatch,
      patternHits: result.patternHits,
      pastEmployers: pastEmployers.map((e) => ({
        canonicalId: e.canonicalId,
        displayName: e.companyName,
        dateRange: [e.startedAt, e.endedAt]
          .map((d) => (typeof d === 'string' ? d.slice(0, 4) : ''))
          .filter(Boolean)
          .join('–') || (e.startedAt ? `${String(e.startedAt).slice(0, 4)}–present` : ''),
      })),
    };
    chunks.push(`\n<!--LABRA_META:${JSON.stringify(meta)}-->`);

    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    logger.info('Evaluation completed and streamed', { userId: authUser.id });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Evaluation failed', error, { userId: (await getAuthUserId())?.id });
    }
    return handleApiError(error);
  }
}
