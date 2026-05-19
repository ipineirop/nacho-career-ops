import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, evaluations, roles, pipelineStatus, outcomes } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { handleApiError, UnauthorizedError, ValidationError } from '@/lib/api/errors';
import { logger } from '@/lib/api/logger';

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserId();
    if (!authUser) {
      throw new UnauthorizedError();
    }

    const format = req.nextUrl.searchParams.get('format') || 'csv';
    if (!['csv', 'json'].includes(format)) {
      throw new ValidationError('Format must be "csv" or "json"');
    }

    const db = getDb();

    // Fetch all evaluations with related data
    const evals = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.userId, authUser.id));

    // Enrich with roles, pipeline status, and outcomes
    const enriched = await Promise.all(
      evals.map(async (evaluation) => {
        const [roleData, pipelineData, outcomeData] = await Promise.all([
          db.select().from(roles).where(eq(roles.id, evaluation.roleId)).limit(1),
          db
            .select()
            .from(pipelineStatus)
            .where(and(eq(pipelineStatus.userId, authUser.id), eq(pipelineStatus.roleId, evaluation.roleId)))
            .limit(1),
          db
            .select()
            .from(outcomes)
            .where(and(eq(outcomes.userId, authUser.id), eq(outcomes.roleId, evaluation.roleId)))
            .limit(1),
        ]);

        return {
          evaluationId: evaluation.id,
          date: evaluation.evaluatedAt?.toISOString().split('T')[0] ?? '',
          company: roleData[0]?.companyName ?? 'Unknown',
          role: roleData[0]?.roleTitle ?? 'Unknown',
          domain: roleData[0]?.domain ?? '',
          location: roleData[0]?.location ?? '',
          remotePolicy: roleData[0]?.remotePolicy ?? '',
          score: evaluation.overallScore ? Number(evaluation.overallScore) : 0,
          recommendation: evaluation.recommendation ?? '',
          cvMatchScore: evaluation.cvMatchScore ? Number(evaluation.cvMatchScore) : 0,
          northStarScore: evaluation.northStarScore ? Number(evaluation.northStarScore) : 0,
          compScore: evaluation.compScore ? Number(evaluation.compScore) : 0,
          culturalScore: evaluation.culturalScore ? Number(evaluation.culturalScore) : 0,
          status: pipelineData[0]?.status ?? 'evaluating',
          appliedAt: pipelineData[0]?.appliedAt?.toISOString().split('T')[0] ?? '',
          notes: pipelineData[0]?.notesMarkdown ?? '',
          outcomeType: outcomeData[0]?.outcomeType ?? '',
          offerBaseUsd: outcomeData[0]?.offerBaseUsd ? Number(outcomeData[0].offerBaseUsd) : '',
          offerTotalUsd: outcomeData[0]?.offerTotalUsd ? Number(outcomeData[0].offerTotalUsd) : '',
          summary: evaluation.verdictSummary ?? '',
        };
      })
    );

    logger.info('Tracker export requested', { userId: authUser.id, format, count: enriched.length });

    if (format === 'json') {
      return new Response(JSON.stringify(enriched, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="tracker-export-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }

    // CSV format
    const headers = [
      'Date',
      'Company',
      'Role',
      'Domain',
      'Location',
      'Remote Policy',
      'Score',
      'Recommendation',
      'CV Match',
      'North Star',
      'Comp',
      'Culture',
      'Status',
      'Applied At',
      'Offer (Base USD)',
      'Offer (Total USD)',
      'Outcome',
      'Notes',
    ];

    const rows = enriched.map((row) => [
      escapeCSV(row.date),
      escapeCSV(row.company),
      escapeCSV(row.role),
      escapeCSV(row.domain),
      escapeCSV(row.location),
      escapeCSV(row.remotePolicy),
      escapeCSV(row.score),
      escapeCSV(row.recommendation),
      escapeCSV(row.cvMatchScore),
      escapeCSV(row.northStarScore),
      escapeCSV(row.compScore),
      escapeCSV(row.culturalScore),
      escapeCSV(row.status),
      escapeCSV(row.appliedAt),
      escapeCSV(row.offerBaseUsd),
      escapeCSV(row.offerTotalUsd),
      escapeCSV(row.outcomeType),
      escapeCSV(row.notes),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tracker-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
