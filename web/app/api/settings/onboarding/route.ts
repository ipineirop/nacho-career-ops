import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/require-auth';
import { getSetting, setSetting } from '@/lib/settings-store';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const value = await getSetting(`${user.email}:leadme_onboarding_complete`);
  return NextResponse.json({ complete: value === 'true' });
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await setSetting(`${user.email}:leadme_onboarding_complete`, 'true');
  return NextResponse.json({ ok: true });
}
