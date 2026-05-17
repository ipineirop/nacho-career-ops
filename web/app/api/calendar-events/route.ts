import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { neon } from '@neondatabase/serverless';

function getUrl() {
  return (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
}

async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const sql = neon(getUrl());
  const rows = await sql`SELECT key, value FROM settings WHERE key = ANY(${keys})`;
  const map: Record<string, string> = {};
  for (const r of rows as { key: string; value: string }[]) map[r.key] = r.value;
  return map;
}

async function upsertSetting(key: string, value: string) {
  const sql = neon(getUrl());
  await sql`INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

async function getValidToken(): Promise<string | null> {
  const map = await getSettings(['google_access_token', 'google_refresh_token', 'google_token_expires_at']);
  if (!map.google_access_token) return null;
  const expiresAt = Number(map.google_token_expires_at ?? 0);
  if (Date.now() < expiresAt - 60000) return map.google_access_token;
  if (!map.google_refresh_token) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: map.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const { access_token, expires_in } = await res.json();
  const newExpiry = Date.now() + (expires_in ?? 3600) * 1000;
  await upsertSetting('google_access_token', access_token);
  await upsertSetting('google_token_expires_at', String(newExpiry));
  return access_token;
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const token = await getValidToken();
  if (!token) return NextResponse.json({ connected: false, events: [] });

  const now = new Date().toISOString();
  const in30days = new Date(Date.now() + 30 * 86400000).toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(in30days)}&singleEvents=true&orderBy=startTime&maxResults=20`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return NextResponse.json({ connected: false, events: [] });

  const { items = [] } = await res.json();

  const jobKeywords = /interview|screen|call|meet|chat|hiring|recruiter|technical|phone|video/i;
  const events = (items as Record<string, unknown>[])
    .filter((e) => jobKeywords.test((e.summary as string) ?? '') || jobKeywords.test((e.description as string) ?? ''))
    .map((e) => ({
      id: e.id,
      title: e.summary,
      start: (e.start as Record<string, string>)?.dateTime ?? (e.start as Record<string, string>)?.date,
      end: (e.end as Record<string, string>)?.dateTime ?? (e.end as Record<string, string>)?.date,
      location: e.location,
      description: (e.description as string)?.slice(0, 200),
      htmlLink: e.htmlLink,
    }));

  return NextResponse.json({ connected: true, events });
}
