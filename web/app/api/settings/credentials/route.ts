import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { neon } from '@neondatabase/serverless';

function getDb() {
  const url = (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
  return neon(url);
}

const KEYS = ['linkedin_email', 'linkedin_password', 'apify_api_token', 'gemini_api_key'];

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const sql = getDb();
  const rows = await sql`SELECT key, value FROM settings WHERE key = ANY(${KEYS})`;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key as string] = r.value as string;
  // Return masked values
  const result = KEYS.map((k) => ({
    key: k,
    masked: map[k] ? `${map[k].slice(0, 4)}${'•'.repeat(Math.max(0, (map[k]?.length ?? 0) - 4))}` : '',
    hasValue: !!map[k],
  }));
  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { key, value } = await req.json();
  if (!KEYS.includes(key)) return NextResponse.json({ error: 'Unknown key' }, { status: 400 });
  const sql = getDb();
  await sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
  return NextResponse.json({ ok: true });
}
