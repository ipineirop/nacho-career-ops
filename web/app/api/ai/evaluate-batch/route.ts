import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { evaluateRole } from '@/lib/ai/evaluate-engine';
import { UnauthorizedError, ValidationError, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/api/logger';
import { getDb, evaluations } from '@/lib/db';
import { eq, gte, and } from 'drizzle-orm';
import { z } from 'zod';

const batchEvaluateSchema = z.object({
  evaluations: z
    .array(
      z.object({
        jd: z.string().min(10),
        url: z.string().url().optional(),
      })
    )
    .min(1)
    .max(10),
});

type BatchEvaluateInput = z.infer<typeof batchEvaluateSchema>;

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for hobby plan

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const body = await req.json();
    const input = batchEvaluateSchema.parse(body);

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
      );

    const availableSlots = 10 - recentEvals.length;
    if (availableSlots <= 0) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded: 10 evaluations per hour' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (input.evaluations.length > availableSlots) {
      return new Response(
        JSON.stringify({
          error: `Rate limit: only ${availableSlots} evaluation${availableSlots === 1 ? '' : 's'} remaining this hour`,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    logger.info('Batch evaluation started', {
      userId: authUser.id,
      count: input.evaluations.length,
    });

    // Evaluate each role sequentially to avoid rate limiting
    const results = [];
    const errors = [];

    for (let i = 0; i < input.evaluations.length; i++) {
      const { jd, url } = input.evaluations[i];

      try {
        const result = await evaluateRole({
          jd,
          url,
          userId: authUser.id,
        });

        results.push({
          index: i,
          success: true,
          data: {
            roleId: result.roleId,
            evaluationId: result.evaluationId,
            score: result.score,
            recommendation: result.recommendation,
            summary: result.summary.split('\n')[0], // First line only
          },
        });

        logger.info('Batch evaluation item completed', {
          userId: authUser.id,
          index: i,
          score: result.score,
        });

        // Small delay between evaluations to avoid rate limiting
        if (i < input.evaluations.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        errors.push({
          index: i,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        logger.warn('Batch evaluation item failed', {
          userId: authUser.id,
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Batch evaluation completed', {
      userId: authUser.id,
      successful: results.length,
      failed: errors.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: input.evaluations.length,
          successful: results.length,
          failed: errors.length,
        },
        results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Batch evaluation failed', error, { userId: (await getAuthUserId())?.id });
    }
    return handleApiError(error);
  }
}
