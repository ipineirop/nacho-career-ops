import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, roles, companies } from '@/lib/db';
import { eq, or, ilike, and, lte, gte, sql } from 'drizzle-orm';
import { searchOpportunitiesSchema } from '@/lib/api/validation';
import { handleApiError, UnauthorizedError, ValidationError } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    // Parse query params
    const params = {
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      domain: req.nextUrl.searchParams.get('domain') ?? undefined,
      location: req.nextUrl.searchParams.get('location') ?? undefined,
      minScore: req.nextUrl.searchParams.get('minScore') ?? undefined,
      maxScore: req.nextUrl.searchParams.get('maxScore') ?? undefined,
      minCompUsd: req.nextUrl.searchParams.get('minCompUsd') ?? undefined,
      maxCompUsd: req.nextUrl.searchParams.get('maxCompUsd') ?? undefined,
      remotePolicy: req.nextUrl.searchParams.get('remotePolicy') ?? undefined,
      seniorityLevel: req.nextUrl.searchParams.get('seniorityLevel') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
      offset: req.nextUrl.searchParams.get('offset') ?? undefined,
    };

    const input = searchOpportunitiesSchema.parse(params);

    const db = getDb();

    // Build WHERE conditions
    const conditions: any[] = [];

    // Full-text search
    if (input.q) {
      conditions.push(
        or(
          ilike(roles.roleTitle, `%${input.q}%`),
          ilike(roles.companyName, `%${input.q}%`),
          ilike(roles.teamDescription, `%${input.q}%`)
        )
      );
    }

    // Domain filter
    if (input.domain) {
      conditions.push(ilike(roles.domain, `%${input.domain}%`));
    }

    // Location filter
    if (input.location) {
      conditions.push(ilike(roles.location, `%${input.location}%`));
    }

    // Remote policy filter
    if (input.remotePolicy) {
      conditions.push(eq(roles.remotePolicy, input.remotePolicy));
    }

    // Seniority level filter
    if (input.seniorityLevel) {
      conditions.push(eq(roles.seniorityLevel, input.seniorityLevel));
    }

    // Compensation range filter
    if (input.minCompUsd && input.maxCompUsd) {
      // Only filter if both bounds exist
      conditions.push(
        and(
          gte(roles.compRangeLow, input.minCompUsd as any),
          lte(roles.compRangeHigh, input.maxCompUsd as any)
        )
      );
    } else if (input.minCompUsd) {
      conditions.push(gte(roles.compRangeLow, input.minCompUsd as any));
    } else if (input.maxCompUsd) {
      conditions.push(lte(roles.compRangeHigh, input.maxCompUsd as any));
    }

    // Execute with pagination
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const results = conditions.length > 0
      ? await db.select().from(roles).where(whereClause).limit(input.limit).offset(input.offset)
      : await db.select().from(roles).limit(input.limit).offset(input.offset);

    // Get total count for pagination info
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(roles)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = (countResult[0]?.count as number) || 0;

    return new Response(
      JSON.stringify({
        success: true,
        data: results,
        pagination: {
          total,
          limit: input.limit,
          offset: input.offset,
          hasMore: input.offset + input.limit < total,
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
