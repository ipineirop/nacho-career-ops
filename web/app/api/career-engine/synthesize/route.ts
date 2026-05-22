import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { synthesizeProfile, type CareerProfile } from '@/lib/career-engine';

export const maxDuration = 120;

// Pass 2 of the engine: turn already-extracted facts into the interpretive
// read (pattern, archetypes, strengths/gaps). Kept separate from the CV
// upload so neither call is long enough to hit the gateway timeout.
export async function POST(req: NextRequest) {
  const user = await getAuthUserId();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { facts, lang } = (await req.json()) as { facts?: Partial<CareerProfile>; lang?: string };
  if (!facts) return NextResponse.json({ error: 'No facts provided' }, { status: 400 });

  const synthesis = await synthesizeProfile({ facts, lang });
  return NextResponse.json({ ok: true, synthesis });
}
