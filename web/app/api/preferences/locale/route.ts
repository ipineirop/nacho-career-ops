import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { getDb, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * POST /api/preferences/locale  { locale: 'en' | 'es' }
 *
 * Persists the user's locale preference. ES is stored as `es-MX` to keep
 * region semantics (the toggle is binary EN/ES but the rest of the system
 * can read region metadata). EN is stored as plain `en`.
 *
 * v1: only locales used by the Brief are accepted. `vos` Spanish variants
 * (es-AR/UY/CR) are deferred per the plan.
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUserId();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = typeof body.locale === 'string' ? body.locale.toLowerCase() : '';
  let stored: string | null = null;
  if (raw === 'en' || raw.startsWith('en-')) stored = 'en';
  else if (raw === 'es' || raw.startsWith('es-')) stored = 'es-MX';

  if (!stored) {
    return NextResponse.json({ error: "locale must be 'en' or 'es'" }, { status: 400 });
  }

  try {
    const db = getDb();
    await db.update(users).set({ locale: stored }).where(eq(users.id, authUser.id));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('locale update failed:', err);
    return NextResponse.json({ error: 'Could not persist locale' }, { status: 500 });
  }
}
