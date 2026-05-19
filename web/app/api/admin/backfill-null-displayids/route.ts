import { getDb, evaluations } from '@/lib/db';
import { eq, isNull } from 'drizzle-orm';

export async function POST(req: Request) {
  const secret = req.headers.get('x-secret');
  if (secret !== 'backfill-null') {
    return new Response('Forbidden', { status: 403 });
  }

  const db = getDb();

  // Get all evaluations without displayId, ordered by user and date
  const nullEvals = await db
    .select()
    .from(evaluations)
    .where(isNull(evaluations.displayId));

  // Group by user
  const byUser: Record<string, typeof nullEvals> = {};
  nullEvals.forEach((e) => {
    if (!byUser[e.userId]) byUser[e.userId] = [];
    byUser[e.userId].push(e);
  });

  // For each user, assign the next sequential displayId
  let updated = 0;
  for (const [userId, userNullEvals] of Object.entries(byUser)) {
    // Get all evaluations for this user to find the max displayId
    const allUserEvals = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.userId, userId));

    const maxNum = Math.max(
      0,
      ...allUserEvals
        .filter((e) => e.displayId)
        .map((e) => parseInt(e.displayId || '0', 10))
    );

    // Assign new displayIds starting from maxNum + 1
    for (let i = 0; i < userNullEvals.length; i++) {
      const displayId = String(maxNum + i + 1).padStart(3, '0');
      await db
        .update(evaluations)
        .set({ displayId })
        .where(eq(evaluations.id, userNullEvals[i].id));
      updated++;
    }
  }

  return new Response(
    JSON.stringify({
      updated,
      message: `Assigned displayIds to ${updated} evaluations`,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
