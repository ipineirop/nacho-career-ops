import 'server-only';
import { getDb, userPreferences, evaluations } from '@/lib/db';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * Is this user's first visit to Tracker after onboarding — the moment we show
 * the coach mark + FAB pulse?
 *
 * True only when BOTH hold:
 *   • coach_mark_dismissed is falsy (sticky once flipped)
 *   • the user has zero evaluations
 *
 * Dev-bypass fallback: when there's no DB (local no-DB preview mode), return
 * true so the teaching moment renders visually. Real users always go through
 * the DB path.
 */
export async function isFirstEvalVisit(userId: string): Promise<boolean> {
  // No DB configured locally — treat as first visit so the dev preview shows
  // the coach mark + pulse without writing/reading anything.
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_POSTGRES_URL) return true;

  try {
    const db = getDb();
    const [pref] = await db
      .select({ dismissed: userPreferences.coachMarkDismissed })
      .from(userPreferences)
      .where(and(eq(userPreferences.userId, userId), isNull(userPreferences.supersededAt)))
      .limit(1);
    if (pref?.dismissed) return false;

    const [any] = await db
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(eq(evaluations.userId, userId))
      .limit(1);
    return !any;
  } catch (err) {
    // If the column doesn't exist yet (migration 0012 not applied) or any
    // other infra error, fail safe to "not first visit" so we don't show the
    // teaching moment to existing users in error states.
    console.error('isFirstEvalVisit failed:', err);
    return false;
  }
}
