import { ReportViewer } from '@/components/reports/ReportViewer';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { getDb, evaluations, roles } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getAuthUserId } from '@/lib/auth-bridge';

export const dynamic = 'force-dynamic';

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  const { id } = await params;
  const paddedId = id.padStart(3, '0');

  const db = getDb();
  const evalRecord = await db
    .select()
    .from(evaluations)
    .where(
      and(
        eq(evaluations.displayId, paddedId),
        eq(evaluations.userId, authUser.id)
      )
    )
    .limit(1);

  if (evalRecord.length === 0) notFound();

  const evaluation = evalRecord[0];
  const roleData = await db
    .select()
    .from(roles)
    .where(eq(roles.id, evaluation.roleId!))
    .limit(1);

  const role = roleData[0];
  const content = evaluation.fullReportMarkdown ?? '_Report content not available. Please re-evaluate this role._';

  const scoreNum = evaluation.overallScore ? Number(evaluation.overallScore) / 20 : null;
  const dateStr = evaluation.evaluatedAt?.toISOString().split('T')[0] ?? '';

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/reports" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={14} /> Reports
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{role?.companyName || 'Unknown'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {dateStr} · #{paddedId} · {scoreNum !== null ? Math.round(scoreNum * 20) : '—'}
          </p>
        </div>
      </div>

      <ReportViewer content={content} />
    </div>
  );
}
