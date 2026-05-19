import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, roles } from '@/lib/db';
import { isNotNull } from 'drizzle-orm';
import { handleApiError, UnauthorizedError } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const db = getDb();

    // Fetch all unique values for filter fields
    const [domainsFetch, locationsFetch, seniorityFetch, remotesFetch, companiesFetch] =
      await Promise.all([
        db
          .selectDistinct({ value: roles.domain })
          .from(roles)
          .where(isNotNull(roles.domain)),
        db
          .selectDistinct({ value: roles.location })
          .from(roles)
          .where(isNotNull(roles.location)),
        db
          .selectDistinct({ value: roles.seniorityLevel })
          .from(roles)
          .where(isNotNull(roles.seniorityLevel)),
        db
          .selectDistinct({ value: roles.remotePolicy })
          .from(roles)
          .where(isNotNull(roles.remotePolicy)),
        db
          .selectDistinct({ value: roles.companyName })
          .from(roles)
          .where(isNotNull(roles.companyName)),
      ]);

    const facets = {
      domains: domainsFetch.map((d) => d.value).filter(Boolean).sort(),
      locations: locationsFetch.map((l) => l.value).filter(Boolean).sort(),
      seniorityLevels: seniorityFetch.map((s) => s.value).filter(Boolean).sort(),
      remotePolicies: remotesFetch.map((r) => r.value).filter(Boolean).sort(),
      companies: companiesFetch.map((c) => c.value).filter(Boolean).sort(),
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: facets,
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
