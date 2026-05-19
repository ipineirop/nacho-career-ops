import { getDb, evaluations, roles } from '@/lib/db';
import { eq, isNull } from 'drizzle-orm';

export async function POST(req: Request) {
  const secret = req.headers.get('x-secret');
  if (secret !== 'backfill-markdown') {
    return new Response('Forbidden', { status: 403 });
  }

  const db = getDb();

  // Get all evaluations without fullReportMarkdown
  const nullMarkdownEvals = await db
    .select()
    .from(evaluations)
    .where(isNull(evaluations.fullReportMarkdown));

  let updated = 0;

  for (const eval_ of nullMarkdownEvals) {
    // Get role data
    const roleData = await db
      .select()
      .from(roles)
      .where(eq(roles.id, eval_.roleId))
      .limit(1);

    const role = roleData[0];
    if (!role) continue;

    // Generate report markdown from existing data
    const score = eval_.overallScore ? Math.round(eval_.overallScore) : 0;
    const reportMarkdown = `# ${role.companyName} · ${role.roleTitle}

**Date:** ${eval_.evaluatedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]}

## Overall Score: ${score}/100

**Recommendation:** ${eval_.recommendation?.toUpperCase() || 'HOLD'}

${eval_.verdictSummary || 'No summary available'}

---

*This report was backfilled from evaluation data. For full details, re-evaluate this role.*
`;

    await db
      .update(evaluations)
      .set({ fullReportMarkdown: reportMarkdown })
      .where(eq(evaluations.id, eval_.id));
    updated++;
  }

  return new Response(
    JSON.stringify({
      updated,
      message: `Generated report markdown for ${updated} evaluations`,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
