import { getDb, evaluations } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth-bridge';
import { eq } from 'drizzle-orm';

export async function GET() {
  const user = await getAuthUserId();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const db = getDb();
  const evals = await db
    .select({
      id: evaluations.id,
      displayId: evaluations.displayId,
      evaluatedAt: evaluations.evaluatedAt,
    })
    .from(evaluations)
    .where(eq(evaluations.userId, user.id));

  return new Response(JSON.stringify(evals, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
