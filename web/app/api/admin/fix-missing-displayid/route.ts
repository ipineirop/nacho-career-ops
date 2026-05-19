import { getDb, evaluations } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth-bridge';
import { eq, isNull, or } from 'drizzle-orm';

export async function POST(req: Request) {
  const secret = req.headers.get('x-secret');
  if (secret !== 'fix-now') {
    return new Response('Forbidden', { status: 403 });
  }

  const user = await getAuthUserId();
  if (!user) {
    // For admin ops, allow running without a specific user context
    // This will process all evaluations across all users
  }

  const db = getDb();

  // Get all evaluations
  const allEvals = await db.select().from(evaluations);

  // Group by user
  const byUser: Record<string, typeof allEvals> = {};
  allEvals.forEach((e) => {
    if (!byUser[e.userId]) byUser[e.userId] = [];
    byUser[e.userId].push(e);
  });

  // Reassign sequential displayIds per user
  let updated = 0;
  for (const userEvals of Object.values(byUser)) {
    userEvals.sort((a, b) => {
      const aTime = a.evaluatedAt?.getTime() ?? 0;
      const bTime = b.evaluatedAt?.getTime() ?? 0;
      return aTime - bTime;
    });

    for (let i = 0; i < userEvals.length; i++) {
      const displayId = String(i + 1).padStart(3, '0');
      if (userEvals[i].displayId !== displayId) {
        await db
          .update(evaluations)
          .set({ displayId })
          .where(eq(evaluations.id, userEvals[i].id));
        updated++;
      }
    }
  }

  return new Response(
    JSON.stringify({
      total: allEvals.length,
      updated,
      message: `Fixed ${updated} evaluations out of ${allEvals.length}`,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
