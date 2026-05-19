import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, interactions, roles } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { handleApiError, UnauthorizedError, NotFoundError, ValidationError } from '@/lib/api/errors';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';

const createInteractionSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
  type: z.enum(['application', 'interview', 'email', 'recruiter_dm', 'offer', 'rejection']),
  direction: z.enum(['inbound', 'outbound']).optional(),
  description: z.string().max(1000).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  metadata: z.record(z.any()).optional(),
});

type CreateInteractionInput = z.infer<typeof createInteractionSchema>;

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const body = await req.json();
    const input = createInteractionSchema.parse(body);

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

    const interaction = await db
      .insert(interactions)
      .values({
        userId: authUser.id,
        roleId: input.roleId,
        type: input.type,
        direction: input.direction,
        occurredAt: new Date(),
        description: input.description,
        sentiment: input.sentiment,
        metadata: input.metadata,
      } as any)
      .returning();

    logger.info('Interaction logged', {
      userId: authUser.id,
      roleId: input.roleId,
      type: input.type,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: interaction[0],
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
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    if (limit > 500) {
      throw new ValidationError('Limit cannot exceed 500');
    }

    const db = getDb();

    const whereCondition = roleId
      ? and(eq(interactions.userId, authUser.id), eq(interactions.roleId, roleId))
      : eq(interactions.userId, authUser.id);

    const results = await db
      .select()
      .from(interactions)
      .where(whereCondition)
      .limit(limit)
      .offset(offset);

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        pagination: {
          limit,
          offset,
        },
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
