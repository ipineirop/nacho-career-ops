import { redirect } from 'next/navigation';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, evaluations, roles } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { ProcessingState } from './ProcessingState';
import { VerdictView } from '@/components/verdict/VerdictView';
import type { FullVerdictMeta, VerdictPayload } from '@/components/verdict/types';
import { EvaluateActions } from './EvaluateActions';

export const dynamic = 'force-dynamic';

export default async function EvaluatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authUser = await getAuthUserId();
  if (!authUser) redirect('/auth/signin');

  const db = getDb();
  const [row] = await db
    .select()
    .from(evaluations)
    .where(and(eq(evaluations.id, id), eq(evaluations.userId, authUser.id)))
    .limit(1);

  if (!row) redirect('/');

  // Processing — placeholder six-row reveal. Polls for the status flip.
  if (row.status === 'processing') {
    return <ProcessingState evaluationId={row.id} />;
  }

  // Failed — surface the error so the user can retry.
  if (row.status === 'failed') {
    return (
      <div className="max-w-[720px] px-s5 py-s6 flex flex-col gap-s4">
        <span className="font-mono text-[11px] uppercase tracking-[0.4px] text-ink-3">Evaluate</span>
        <h1 className="font-serif text-[28px] leading-[1.12] text-ink m-0">
          Something went wrong<em className="italic">.</em>
        </h1>
        <p className="font-body text-[14px] leading-[1.55] text-ink-2">
          {row.verdictSummary ?? 'The evaluation could not be completed. Try pasting it again from the Evaluate button.'}
        </p>
      </div>
    );
  }

  // Complete — reuse the existing editorial verdict (user-confirmed).
  // Reconstruct the meta shape from the saved row.
  const [roleRow] = row.roleId
    ? await db.select().from(roles).where(eq(roles.id, row.roleId)).limit(1)
    : [null];

  const payload = (row.verdictPayload ?? null) as VerdictPayload | null;
  const patternHits = Array.isArray(payload?.patternHits) ? (payload!.patternHits as string[]) : [];
  const sourceLabel = row.inputType === 'dm' ? 'message' : 'job posting';

  const meta: FullVerdictMeta = {
    evaluationId: row.id,
    roleId: row.roleId ?? '',
    displayId: row.displayId ?? undefined,
    verdict: payload ?? undefined,
    role: roleRow
      ? {
          company: roleRow.companyName ?? '',
          title: roleRow.roleTitle ?? '',
          location: roleRow.location ?? '',
          remotePolicy: roleRow.remotePolicy ?? '',
          seniority: roleRow.seniorityLevel ?? '',
          sourceLabel,
          url: roleRow.sourceRef && /^https?:\/\//i.test(roleRow.sourceRef) ? roleRow.sourceRef : null,
        }
      : undefined,
    pastEmployerMatch: (row.pastEmployerMatch as FullVerdictMeta['pastEmployerMatch']) ?? null,
    patternHits,
    // The §5.2 picker is dormant on revisit — kept empty here per known limitation.
    pastEmployers: [],
  };

  if (!payload) {
    // Legacy row marked complete but with no editorial payload: show the saved
    // markdown report instead of a broken VerdictView.
    return (
      <div className="max-w-[720px] px-s5 py-s6">
        <span className="font-mono text-[11px] uppercase tracking-[0.4px] text-ink-3">Evaluate</span>
        <h1 className="font-serif text-[28px] leading-[1.12] text-ink m-0 mb-s4">The read<em className="italic">.</em></h1>
        <pre className="font-body text-[14px] leading-[1.55] text-ink-2 whitespace-pre-wrap">
          {row.fullReportMarkdown ?? row.verdictSummary ?? ''}
        </pre>
      </div>
    );
  }

  return <EvaluateActions meta={meta} />;
}
