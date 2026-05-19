import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, invitations } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { handleApiError, UnauthorizedError, ValidationError, ForbiddenError } from '@/lib/api/errors';
import { logger } from '@/lib/api/logger';
import { z } from 'zod';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'pineiro.ignacio@gmail.com';

const generateInvitationSchema = z.object({
  notes: z.string().max(200).optional(),
  expiryDays: z.number().min(1).max(365).default(30),
});

type GenerateInvitationInput = z.infer<typeof generateInvitationSchema>;

// Generate a random invitation code
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 24; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Format: ABC-DEF-GHI-JKL (4 segments)
  return [
    code.slice(0, 4),
    code.slice(4, 8),
    code.slice(8, 12),
    code.slice(12, 16),
  ].join('-');
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    // Only admin can generate codes
    if (authUser.email !== ADMIN_EMAIL) {
      throw new ForbiddenError('Only the admin can generate invitation codes');
    }

    const body = await req.json();
    const input = generateInvitationSchema.parse(body);

    const db = getDb();

    // Generate unique code
    let code: string;
    let attempts = 0;
    while (attempts < 5) {
      code = generateCode();
      const existing = await db
        .select()
        .from(invitations)
        .where(eq(invitations.code, code))
        .limit(1);

      if (!existing.length) break;
      attempts++;
    }

    if (attempts >= 5) {
      throw new Error('Failed to generate unique invitation code');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.expiryDays);

    const invitation = await db
      .insert(invitations)
      .values({
        code: code!,
        createdBy: authUser.id,
        expiresAt,
        notes: input.notes,
        status: 'active',
      })
      .returning();

    logger.info('Invitation code generated', {
      userId: authUser.id,
      code: code!,
      expiryDays: input.expiryDays,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          code: invitation[0].code,
          expiresAt: invitation[0].expiresAt,
          notes: invitation[0].notes,
          shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/signup?code=${invitation[0].code}`,
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

    // Get all codes created by this user
    const codes = await db
      .select()
      .from(invitations)
      .where(eq(invitations.createdBy, authUser.id))
      .orderBy((i) => i.createdAt);

    return new Response(
      JSON.stringify({
        success: true,
        data: codes.map((c) => ({
          code: c.code,
          status: c.status,
          claimedBy: c.claimedBy,
          claimedAt: c.claimedAt,
          expiresAt: c.expiresAt,
          notes: c.notes,
          createdAt: c.createdAt,
        })),
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
