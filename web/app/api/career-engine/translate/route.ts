import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-bridge';
import { translateProfile, type TranslatableProfile } from '@/lib/career-engine';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getAuthUserId();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fields, targetLang } = (await req.json()) as {
    fields?: TranslatableProfile;
    targetLang?: 'en' | 'es';
  };
  if (!fields || (targetLang !== 'en' && targetLang !== 'es')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const translated = await translateProfile(fields, targetLang);
  return NextResponse.json({ ok: true, fields: translated });
}
