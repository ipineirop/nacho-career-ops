import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, userEvents, type NewUserEvent } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { handleApiError, UnauthorizedError, ValidationError, NotFoundError } from '@/lib/api/errors';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';

const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.object({
    q: z.string().optional(),
    domain: z.string().optional(),
    location: z.string().optional(),
    remotePolicy: z.enum(['remote', 'hybrid', 'onsite']).optional(),
    seniorityLevel: z.string().optional(),
    minScore: z.number().optional(),
    maxScore: z.number().optional(),
    minCompUsd: z.number().optional(),
    maxCompUsd: z.number().optional(),
  }),
});

type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const body = await req.json();
    const input = createSavedSearchSchema.parse(body);

    const db = getDb();

    // Create saved search event
    const savedSearch = await db
      .insert(userEvents)
      .values({
        userId: authUser.id,
        eventType: 'saved_search_created',
        eventData: {
          name: input.name,
          query: input.query,
          savedAt: new Date().toISOString(),
        },
      } as NewUserEvent)
      .returning();

    logger.info('Saved search created', {
      userId: authUser.id,
      name: input.name,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: savedSearch[0].id,
          name: input.name,
          query: input.query,
          createdAt: savedSearch[0].occurredAt,
        },
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

    const db = getDb();

    // Get all saved search events for user
    const savedSearches = await db
      .select()
      .from(userEvents)
      .where(eq(userEvents.userId, authUser.id) && eq(userEvents.eventType, 'saved_search_created'))
      .orderBy((e) => e.occurredAt);

    const formatted = savedSearches.map((e) => ({
      id: e.id,
      name: (e.eventData as any)?.name,
      query: (e.eventData as any)?.query,
      createdAt: e.occurredAt,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: formatted,
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

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const searchId = req.nextUrl.searchParams.get('id');
    if (!searchId) {
      throw new ValidationError('id query parameter is required');
    }

    const db = getDb();

    // Verify ownership and delete
    const search = await db
      .select()
      .from(userEvents)
      .where(eq(userEvents.id, searchId) && eq(userEvents.userId, authUser.id))
      .limit(1);

    if (!search.length) {
      throw new NotFoundError('Saved search');
    }

    await db.delete(userEvents).where(eq(userEvents.id, searchId));

    logger.info('Saved search deleted', {
      userId: authUser.id,
      searchId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Saved search deleted',
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
