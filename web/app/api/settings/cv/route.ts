import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { parseCv } from '@/lib/career-engine';
import { persistCareerHistory } from '@/lib/ai/candidate-context';
import { setSetting } from '@/lib/settings-store';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getAuthUserId();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text, base64, lang } = await req.json();
  if (!text?.trim() && !base64?.trim()) {
    return NextResponse.json({ error: 'No content provided' }, { status: 400 });
  }

  // Pass 1: fast factual parse. Synthesis (pattern, archetypes) runs later via
  // /api/career-engine/synthesize so it never blocks this upload request.
  const { markdownCv, profile } = await parseCv({ text, base64, lang });

  // Dev bypass: no DB available locally — return the profile without persisting.
  const dbConfigured = !!(process.env.SUPABASE_POSTGRES_URL || process.env.DATABASE_URL);
  if (!dbConfigured) {
    return NextResponse.json({ ok: true, signals: profile, preview: markdownCv.slice(0, 800) });
  }

  const { getDb, userProfiles } = await import('@/lib/db');
  const { eq } = await import('drizzle-orm');
  const db = getDb();

  const existingProfile = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  const cvPatch = {
    cvMarkdown: markdownCv,
    cvUploadedAt: new Date(),
    languages: profile.languages?.length ? profile.languages : undefined,
    industries: profile.industries?.length ? profile.industries : undefined,
    education: profile.education?.length ? profile.education : undefined,
    seniorityLevel: profile.seniorityLevel ?? undefined,
    primaryFunction: profile.primaryFunction ?? undefined,
  };

  if (existingProfile.length > 0) {
    await db.update(userProfiles).set(cvPatch).where(eq(userProfiles.userId, user.id));
  } else {
    await db.insert(userProfiles).values({ userId: user.id, ...cvPatch });
  }

  // Structured CV sections for re-rendering the markdown later. Best-effort:
  // these columns may not exist until migration 0004 is applied.
  try {
    await db.update(userProfiles)
      .set({ summaryMarkdown: profile.summary || undefined, skills: profile.skills?.length ? profile.skills : undefined })
      .where(eq(userProfiles.userId, user.id));
  } catch (err) {
    console.error('summary/skills persist skipped (migration 0004 not applied?):', err);
  }

  // Structured career history is the source of truth for role facts. Seed it
  // from the parse; step 3 corrections overwrite it on onboarding save.
  await persistCareerHistory(user.id, profile.roles ?? [], 'cv_parse');

  // Mirror the raw markdown into settings:cv_content (Supabase) for the
  // onboarding gate and AI flows that still read it by key.
  await setSetting(`${user.email}:cv_content`, markdownCv);

  return NextResponse.json({ ok: true, signals: profile, preview: markdownCv.slice(0, 800) });
}
