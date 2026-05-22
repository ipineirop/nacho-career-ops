import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { evaluateRole } from '@/lib/ai/evaluate-engine';
import { UnauthorizedError, ValidationError, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/api/logger';
import { getDb, evaluations, userCareerHistory } from '@/lib/db';
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

    const { jd, url } = await req.json();
    if (!jd || !jd.trim()) {
      throw new ValidationError('JD (job description) is required');
    }

    logger.info('Evaluation request received', { userId: authUser.id, hasUrl: !!url });

    // Run evaluation
    const result = await evaluateRole({
      jd: jd.trim(),
      url,
      userId: authUser.id,
    });

    // Build streaming response
    const encoder = new TextEncoder();

    const chunks = [
      `# Evaluación: ${result.summary.split('\n')[0]}\n\n`,
      `**Score:** ${Math.round(result.score * 20)}/100 (${result.score.toFixed(1)}/5)\n`,
      `**Recomendación:** ${result.recommendation.toUpperCase()}\n\n`,
      `## Dimensiones de Evaluación\n\n`,
      ...result.dimensions.map((dim) =>
        `### ${dim.name}\n**Calificación:** ${dim.grade} (${dim.score}/100)\n\n${dim.reasoning}\n\n`
      ),
    ];

    if (result.gaps.length > 0) {
      chunks.push(`## Señales de Alerta\n\n`);
      chunks.push(
        ...result.gaps.map(
          (gap) => `- **${gap.description}** [${gap.severity}]\n  Mitigación: ${gap.mitigation}\n\n`
        )
      );
    }

    if (result.proofPoints.length > 0) {
      chunks.push(`## Puntos de Evidencia\n\n`);
      chunks.push(
        ...result.proofPoints.map((pp) => `| ${pp.requirement} | ${pp.matchStrength} |\n`)
      );
    }

    chunks.push(`\n## Resumen\n\n${result.summary}\n`);

    // Structured trailer (parsed + stripped by the client) — carries the
    // interactive verdict surfaces that don't belong in the markdown body:
    // the past-employer match record (§3.5a/§5.1), pattern hits (§3.5b), and
    // the user's past employers for the §5.2 "this is actually…" picker.
    const pastEmployers = await db
      .select({
        canonicalId: userCareerHistory.canonicalId,
        companyName: userCareerHistory.companyName,
        startedAt: userCareerHistory.startedAt,
        endedAt: userCareerHistory.endedAt,
      })
      .from(userCareerHistory)
      .where(eq(userCareerHistory.userId, authUser.id));

    const meta = {
      evaluationId: result.evaluationId,
      roleId: result.roleId,
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
