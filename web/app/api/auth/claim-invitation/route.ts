import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, invitations } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { handleApiError, UnauthorizedError, ValidationError, NotFoundError } from '@/lib/api/errors';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';

const claimInvitationSchema = z.object({
  code: z.string().min(1).max(32),
});

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const body = await req.json();
    const { code } = claimInvitationSchema.parse(body);

    const db = getDb();

    // Find the invitation code
    const existing = await db
      .select()
      .from(invitations)
      .where(eq(invitations.code, code))
      .limit(1);

    if (!existing.length) {
      throw new NotFoundError('Invitation code not found');
    }

    const invitation = existing[0];

    // Validate code is active
    if (invitation.status !== 'active') {
      throw new ValidationError(`Invitation code is ${invitation.status}`);
    }

    // Validate code is not expired
    if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
      await db
        .update(invitations)
        .set({ status: 'expired' })
        .where(eq(invitations.id, invitation.id));
      throw new ValidationError('Invitation code has expired');
    }

    // Validate code is not already claimed
    if (invitation.claimedBy) {
      throw new ValidationError('Invitation code has already been claimed');
    }

    // Claim the code
    const claimed = await db
      .update(invitations)
      .set({
        claimedBy: authUser.id,
        claimedAt: new Date(),
        status: 'claimed',
      })
      .where(eq(invitations.id, invitation.id))
      .returning();

    logger.info('Invitation code claimed', {
      userId: authUser.id,
      code,
      invitationId: invitation.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          invitationId: claimed[0].id,
          code: claimed[0].code,
          claimedAt: claimed[0].claimedAt,
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
