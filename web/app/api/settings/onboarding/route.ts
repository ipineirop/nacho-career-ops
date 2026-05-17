import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/require-auth';
import { neon } from '@neondatabase/serverless';

function getDb() {
  const url = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
  return neon(url);
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getDb();
  const key = `${user.email}:leadme_onboarding_complete`;
  const rows = await sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`;
  return NextResponse.json({ complete: rows.length > 0 && (rows[0] as { value: string }).value === 'true' });
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getDb();
  const key = `${user.email}:leadme_onboarding_complete`;
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, 'true', NOW())
    ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()
  `;
  return NextResponse.json({ ok: true });
}
