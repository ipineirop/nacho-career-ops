import { getDb, evaluations } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const secret = req.headers.get('x-secret');
  if (secret !== 'backfill-now') {
    return new Response('Forbidden', { status: 403 });
  }

  const db = getDb();

  // Get all evaluations
  const allEvals = await db.select().from(evaluations);

  // Group by user and sort by date
  const byUser: Record<string, typeof allEvals> = {};
  allEvals.forEach((e) => {
    if (!byUser[e.userId]) byUser[e.userId] = [];
    byUser[e.userId].push(e);
  });

  Object.values(byUser).forEach((userEvals) => {
    userEvals.sort((a, b) => {
      const aTime = a.evaluatedAt?.getTime() ?? 0;
      const bTime = b.evaluatedAt?.getTime() ?? 0;
      return aTime - bTime;
    });
  });

  // Update each with sequential displayId
  let updated = 0;
  for (const userEvals of Object.values(byUser)) {
    for (let i = 0; i < userEvals.length; i++) {
      const displayId = String(i + 1).padStart(3, '0');
      if (!userEvals[i].displayId) {
        await db
          .update(evaluations)
          .set({ displayId })
          .where(eq(evaluations.id, userEvals[i].id));
        updated++;
      }
    }
  }

  return new Response(JSON.stringify({ updated }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
