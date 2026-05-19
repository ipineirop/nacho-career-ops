import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { draftOutreach } from '@/lib/ai/outreach-engine';
import { UnauthorizedError, ValidationError, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';

const draftOutreachSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
  tone: z.enum(['warm', 'cool', 'decline']),
});

type DraftOutreachInput = z.infer<typeof draftOutreachSchema>;

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const body = await req.json();
    const input = draftOutreachSchema.parse(body);

    logger.info('Outreach draft requested', {
      userId: authUser.id,
      roleId: input.roleId,
      tone: input.tone,
    });

    const result = await draftOutreach({
      roleId: input.roleId,
      userId: authUser.id,
      tone: input.tone,
    });

    logger.info('Outreach draft completed', {
      userId: authUser.id,
      roleId: input.roleId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Outreach draft failed', error, { userId: (await getAuthUserId())?.id });
    }
    return handleApiError(error);
  }
}
