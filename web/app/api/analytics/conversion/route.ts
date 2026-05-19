import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, evaluations, outcomes, pipelineStatus, roles } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { handleApiError, UnauthorizedError } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const db = getDb();

    // Overall stats
    const evals = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.userId, authUser.id));

    const totalEvaluations = evals.length;

    // Count applications (any status != evaluating)
    const applications = await db
      .select()
      .from(pipelineStatus)
      .where(eq(pipelineStatus.userId, authUser.id))
      .then((ps) => ps.filter((p) => p.status !== 'evaluating'));

    const totalApplications = applications.length;

    // Count offers
    const offers = await db
      .select()
      .from(outcomes)
      .where(eq(outcomes.userId, authUser.id))
      .then((oc) => oc.filter((o) => o.outcomeType === 'offer'));

    const totalOffers = offers.length;

    // By domain
    const byDomain = await Promise.all(
      [...new Set(evals.map((e) => e.roleId))].map(async (roleId) => {
        const role = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
        return role[0]?.domain || 'Unknown';
      })
    );

    const domainStats: Record<string, any> = {};
    for (const domain of byDomain) {
      domainStats[domain] = {
        total: (domainStats[domain]?.total || 0) + 1,
        applications: applications.filter((a) =>
          evals.find((e) => e.roleId === a.roleId)?.roleId
        ).length,
        offers: offers.filter((o) =>
          evals.find((e) => e.roleId === o.roleId)?.roleId
        ).length,
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          overall: {
            totalEvaluations,
            totalApplications,
            totalOffers,
            conversionRate:
              totalApplications > 0
                ? ((totalOffers / totalApplications) * 100).toFixed(1)
                : 0,
          },
          byDomain: domainStats,
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
