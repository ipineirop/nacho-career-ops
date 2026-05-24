import { evaluateRole } from '@/lib/ai/evaluate-engine';
import { getDb, evaluations } from '@/lib/db';
import { and, eq } from 'drizzle-orm';

/**
 * Fire-and-forget background pipeline for the FAB+panel flow. The route
 * creates the evaluations row with status='processing' and returns its id
 * immediately; this function picks up that id, runs the canonical (modes-
 * driven) evaluateRole, and flips the row to status='complete' (or 'failed').
 *
 * Designed to be invoked via Next.js `after(...)` so it runs after the HTTP
 * response is sent, within the Vercel Fluid Compute graceful-shutdown window.
 * Best-effort: this function never throws — failures are persisted as status.
 */
export async function runBackgroundPipeline(params: {
  evaluationId: string;
  userId: string;
  rawInput: string;
}): Promise<void> {
  const { evaluationId, userId, rawInput } = params;
  try {
    await evaluateRole({
      jd: rawInput,
      userId,
      existingEvaluationId: evaluationId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Background evaluation failed';
    console.error('runBackgroundPipeline failed', { evaluationId, message });
    try {
      const db = getDb();
      await db
        .update(evaluations)
        .set({
          status: 'failed',
          // verdictSummary is the easiest place to surface the failure reason on the
          // UI without adding a new column; the processing page can show it.
          verdictSummary: message,
        })
        .where(and(eq(evaluations.id, evaluationId), eq(evaluations.userId, userId)));
    } catch (markErr) {
      console.error('Failed to mark evaluation as failed', markErr);
    }
  }
}
