import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, roles } from '@/lib/db';
import { eq, and, or, ne, ilike } from 'drizzle-orm';
import { handleApiError, UnauthorizedError, ValidationError, NotFoundError } from '@/lib/api/errors';

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

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10', 10);

    const db = getDb();

    // Get the reference role
    const refRole = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);

    if (!refRole.length) {
      throw new NotFoundError('Role');
    }

    const ref = refRole[0];

    // Find similar roles by:
    // 1. Same domain
    // 2. Same or similar seniority level
    // 3. Similar location or remote
    // 4. Similar comp range
    // 5. Don't include the reference role itself

    const conditions: any[] = [ne(roles.id, roleId)];

    // Match by domain
    if (ref.domain) {
      conditions.push(ilike(roles.domain, `%${ref.domain}%`));
    }

    const similarRoles = await db
      .select()
      .from(roles)
      .where(and(...conditions))
      .limit(limit);

    // Score and sort by similarity
    const scored = similarRoles.map((r) => {
      let score = 0;

      // Domain match (40 points)
      if (r.domain === ref.domain) score += 40;
      else if (r.domain && ref.domain && r.domain.includes(ref.domain)) score += 20;

      // Seniority match (30 points)
      if (r.seniorityLevel === ref.seniorityLevel) score += 30;

      // Location match (20 points)
      if (r.location === ref.location) score += 20;
      else if (r.remotePolicy === ref.remotePolicy && ref.remotePolicy === 'remote') score += 10;

      // Comp range overlap (10 points)
      if (
        ref.compRangeLow &&
        ref.compRangeHigh &&
        r.compRangeLow &&
        r.compRangeHigh &&
        !(Number(r.compRangeHigh) < Number(ref.compRangeLow) * 0.7) &&
        !(Number(r.compRangeLow) > Number(ref.compRangeHigh) * 1.3)
      ) {
        score += 10;
      }

      return { ...r, similarityScore: score };
    });

    // Sort by similarity score descending
    scored.sort((a, b) => b.similarityScore - a.similarityScore);

    return new Response(
      JSON.stringify({
        success: true,
        data: scored.map((r) => ({
          ...r,
          similarityScore: undefined, // Don't expose scoring to client
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
