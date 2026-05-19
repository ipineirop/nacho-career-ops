import { getDb, evaluations } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth-bridge';
import { eq, isNull, or } from 'drizzle-orm';

export async function POST(req: Request) {
  const user = await getAuthUserId();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const db = getDb();

  // Get all evaluations for this user
  const allEvals = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.userId, user.id));

  // Group by user and sort by date
  const userEvals = allEvals.sort((a, b) => {
    const aTime = a.evaluatedAt?.getTime() ?? 0;
    const bTime = b.evaluatedAt?.getTime() ?? 0;
    return aTime - bTime;
  });

  // Reassign sequential displayIds
  let updated = 0;
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

  return new Response(
    JSON.stringify({
      total: userEvals.length,
      updated,
      message: `Fixed ${updated} evaluations out of ${userEvals.length}`,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
