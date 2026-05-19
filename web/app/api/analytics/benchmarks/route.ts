import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, marketSignals, roles, evaluations } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { handleApiError, UnauthorizedError, ValidationError } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const db = getDb();

    // Get query params for filtering
    const function_ = req.nextUrl.searchParams.get('function');
    const level = req.nextUrl.searchParams.get('level');
    const geo = req.nextUrl.searchParams.get('geo');
    const domain = req.nextUrl.searchParams.get('domain');

    // Get market signals (pre-calculated benchmarks)
    const benchmarks = await db.select().from(marketSignals);

    // Filter by criteria if provided
    let filtered = benchmarks;
    if (function_ || level || geo || domain) {
      filtered = benchmarks.filter((b) => {
        const seg = b.segment || '';
        if (function_ && !seg.includes(function_)) return false;
        if (level && !seg.includes(level)) return false;
        if (geo && !seg.includes(geo)) return false;
        if (domain && !seg.includes(domain)) return false;
        return true;
      });
    }

    // If no market signals yet, generate from user's data
    if (filtered.length === 0) {
      const evals = await db
        .select()
        .from(evaluations)
        .where(eq(evaluations.userId, authUser.id));

      const rolesData = await db.select().from(roles);

      const enriched = evals.map((e) => {
        const role = rolesData.find((r) => r.id === e.roleId);
        return { evaluation: e, role };
      });

      // Group by function + level + geo
      const bySegment: Record<string, any> = {};
      for (const { evaluation, role } of enriched) {
        if (!role || !role.compRangeLow || !role.compRangeHigh) continue;

        const seg = [role.function, role.seniorityLevel, role.location]
          .filter(Boolean)
          .join(' > ');

        if (!bySegment[seg]) {
          bySegment[seg] = [];
        }
        bySegment[seg].push((Number(role.compRangeLow) + Number(role.compRangeHigh)) / 2);
      }

      // Calculate stats
      const userBenchmarks = Object.entries(bySegment)
        .map(([segment, salaries]) => {
          const sorted = (salaries as number[]).sort((a, b) => a - b);
          const p25 = sorted[Math.floor(sorted.length * 0.25)];
          const p75 = sorted[Math.floor(sorted.length * 0.75)];
          const median = sorted[Math.floor(sorted.length * 0.5)];

          return {
            segment,
            medianCompUsd: Math.round(median),
            p25CompUsd: Math.round(p25),
            p75CompUsd: Math.round(p75),
            sampleSize: sorted.length,
            confidenceLevel: sorted.length >= 3 ? 'medium' : 'low',
          };
        })
        .filter((b) => {
          if (function_ && !b.segment.includes(function_)) return false;
          if (level && !b.segment.includes(level)) return false;
          if (geo && !b.segment.includes(geo)) return false;
          if (domain && !b.segment.includes(domain)) return false;
          return true;
        });

      return new Response(
        JSON.stringify({
          success: true,
          source: 'user_data',
          data: userBenchmarks.sort((a, b) => b.medianCompUsd - a.medianCompUsd),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        source: 'market_signals',
        data: filtered.sort((a, b) => (Number(b.medianCompUsd) || 0) - (Number(a.medianCompUsd) || 0)),
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
