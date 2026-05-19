import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, roles } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { handleApiError, UnauthorizedError, NotFoundError, ValidationError } from '@/lib/api/errors';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';

// Use a simple JSON file-based approach for favorites (can be replaced with DB table later)
// Stored in Supabase Storage or similar
const createFavoriteSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
  notes: z.string().max(500).optional(),
});

type CreateFavoriteInput = z.infer<typeof createFavoriteSchema>;

// For now, store as user events with type 'favorite_added'
import { userEvents, type NewUserEvent } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const body = await req.json();
    const input = createFavoriteSchema.parse(body);

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

    // Check if already favorited
    const existing = await db
      .select()
      .from(userEvents)
      .where(
        eq(userEvents.userId, authUser.id) &&
        eq(userEvents.eventType, 'favorite_added') &&
        eq(userEvents.eventData, { roleId: input.roleId })
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ValidationError('Role is already favorited');
    }

    // Create favorite event
    const favorite = await db
      .insert(userEvents)
      .values({
        userId: authUser.id,
        eventType: 'favorite_added',
        eventData: {
          roleId: input.roleId,
          notes: input.notes,
          favoriteAt: new Date().toISOString(),
        },
      } as NewUserEvent)
      .returning();

    logger.info('Role favorited', { userId: authUser.id, roleId: input.roleId });

    return new Response(
      JSON.stringify({
        success: true,
        data: favorite[0],
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

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

    const db = getDb();

    // Get all favorite events for user
    const favoriteEvents = await db
      .select()
      .from(userEvents)
      .where(eq(userEvents.userId, authUser.id) && eq(userEvents.eventType, 'favorite_added'))
      .limit(limit)
      .offset(offset);

    // Extract roleIds and fetch role data
    const roleIds = favoriteEvents
      .map((e) => (e.eventData as any)?.roleId)
      .filter(Boolean);

    const favoriteRoles = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleIds[0]))
      .limit(limit)
      .offset(offset);

    return new Response(
      JSON.stringify({
        success: true,
        data: favoriteRoles,
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

export async function DELETE(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const roleId = req.nextUrl.searchParams.get('roleId');
    if (!roleId) {
      throw new ValidationError('roleId query parameter is required');
    }

    const db = getDb();

    // Delete favorite event
    await db.delete(userEvents).where(
      eq(userEvents.userId, authUser.id) &&
        eq(userEvents.eventType, 'favorite_added')
    );

    logger.info('Role unfavorited', { userId: authUser.id, roleId });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Role removed from favorites',
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
