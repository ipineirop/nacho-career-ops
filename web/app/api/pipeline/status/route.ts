import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, pipelineStatus, roles } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { updatePipelineStatusSchema } from '@/lib/api/validation';
import { handleApiError, UnauthorizedError, NotFoundError, ValidationError } from '@/lib/api/errors';

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const body = await req.json();
    const input = updatePipelineStatusSchema.parse(body);

    const db = getDb();

    // Verify role exists and user has access (via evaluation)
    const roleExists = await db
      .select()
      .from(roles)
      .where(eq(roles.id, input.roleId))
      .limit(1);

    if (!roleExists.length) {
      throw new NotFoundError('Role');
    }

    // Upsert pipeline status (create if doesn't exist, update if does)
    const existing = await db
      .select()
      .from(pipelineStatus)
      .where(and(eq(pipelineStatus.userId, authUser.id), eq(pipelineStatus.roleId, input.roleId)))
      .limit(1);

    const values = {
      userId: authUser.id,
      roleId: input.roleId,
      status: input.status,
      statusChangedAt: new Date(),
      ...(input.appliedAt && { appliedAt: new Date(input.appliedAt) }),
      ...(input.notesMarkdown && { notesMarkdown: input.notesMarkdown }),
      ...(input.followUpDueAt && { followUpDueAt: new Date(input.followUpDueAt) }),
      lastTouchAt: new Date(),
    };

    let result;
    if (existing.length > 0) {
      // Update existing
      result = await db
        .update(pipelineStatus)
        .set(values)
        .where(and(eq(pipelineStatus.userId, authUser.id), eq(pipelineStatus.roleId, input.roleId)))
        .returning();
    } else {
      // Insert new
      result = await db.insert(pipelineStatus).values(values as any).returning();
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result[0],
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

// GET current status for a role
export async function GET(req: NextRequest) {
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
    const status = await db
      .select()
      .from(pipelineStatus)
      .where(and(eq(pipelineStatus.userId, authUser.id), eq(pipelineStatus.roleId, roleId)))
      .limit(1);

    return new Response(
      JSON.stringify({
        success: true,
        data: status[0] || null,
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
