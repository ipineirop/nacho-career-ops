import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, evaluations, roles } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { handleApiError, UnauthorizedError } from '@/lib/api/errors';

interface PatternStats {
  dimension: string;
  value: string;
  count: number;
  avgScore: number;
  topRecommendation: string;
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const db = getDb();

    // Get all evaluations with role data
    const evals = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.userId, authUser.id));

    const rolesData = await db.select().from(roles);

    // Enrich evaluations with role data
    const enriched = evals.map((e) => {
      const role = rolesData.find((r) => r.id === e.roleId);
      return {
        evaluation: e,
        role,
      };
    });

    // Analyze patterns by dimension
    const patterns: Record<string, Record<string, PatternStats>> = {
      domain: {},
      seniorityLevel: {},
      function: {},
      remotePolicy: {},
    };

    for (const { evaluation, role } of enriched) {
      if (!role) continue;

      const dimensions = {
        domain: role.domain,
        seniorityLevel: role.seniorityLevel,
        function: role.function,
        remotePolicy: role.remotePolicy,
      };

      for (const [dim, value] of Object.entries(dimensions)) {
        if (!value) continue;

        if (!patterns[dim][value]) {
          patterns[dim][value] = {
            dimension: dim,
            value,
            count: 0,
            avgScore: 0,
            topRecommendation: 'unknown',
          };
        }

        const stat = patterns[dim][value];
        stat.count += 1;
        stat.avgScore =
          (stat.avgScore * (stat.count - 1) + Number(evaluation.overallScore || 0)) /
          stat.count;
        stat.topRecommendation = evaluation.recommendation || 'unknown';
      }
    }

    // Convert to arrays and sort
    const result = Object.entries(patterns).reduce(
      (acc, [dim, stats]) => {
        acc[dim] = Object.values(stats).sort((a, b) => b.avgScore - a.avgScore);
        return acc;
      },
      {} as Record<string, PatternStats[]>
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
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
