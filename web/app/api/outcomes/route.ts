import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, outcomes, roles } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { createOutcomeSchema } from '@/lib/api/validation';
import { handleApiError, UnauthorizedError, NotFoundError } from '@/lib/api/errors';
import { logger } from '@/lib/api/logger';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const body = await req.json();
    const input = createOutcomeSchema.parse(body);

    const db = getDb();

    // Verify role exists
    const roleExists = await db
      .select()
      .from(roles)
      .where(eq(roles.id, input.roleId))
      .limit(1);

    if (!roleExists.length) {
      throw new NotFoundError('Role');
    }

    const outcomeRecord = await db
      .insert(outcomes)
      .values({
        userId: authUser.id,
        roleId: input.roleId,
        outcomeType: input.outcomeType,
        occurredAt: new Date(),
        offerBaseUsd: input.offerBaseUsd ? Number(input.offerBaseUsd) : undefined,
        offerTotalUsd: input.offerTotalUsd ? Number(input.offerTotalUsd) : undefined,
        offerCurrency: input.offerCurrency,
        negotiatedDeltaPct: input.negotiatedDeltaPct ? Number(input.negotiatedDeltaPct) : undefined,
        rejectionReason: input.rejectionReason,
        notesMarkdown: input.notesMarkdown,
      } as any)
      .returning();

    logger.info('Outcome recorded', {
      userId: authUser.id,
      roleId: input.roleId,
      outcomeType: input.outcomeType,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: outcomeRecord[0],
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const roleId = req.nextUrl.searchParams.get('roleId');

    const db = getDb();

    const whereCondition = roleId
      ? and(eq(outcomes.userId, authUser.id), eq(outcomes.roleId, roleId))
      : eq(outcomes.userId, authUser.id);

    const results = await db
      .select()
      .from(outcomes)
      .where(whereCondition);

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
