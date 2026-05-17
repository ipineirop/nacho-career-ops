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

const JOB_QUERY = 'subject:(opportunity OR interview OR application OR position OR role OR "get in touch" OR "following up" OR "next steps" OR "offer") newer_than:30d';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const token = await getValidToken();
  if (!token) return NextResponse.json({ connected: false, threads: [] });

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(JOB_QUERY)}&maxResults=20`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!listRes.ok) return NextResponse.json({ connected: false, threads: [] });

  const { threads = [] } = await listRes.json();

  const details = await Promise.all(
    (threads as { id: string }[]).slice(0, 15).map(async (t) => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!r.ok) return null;
      const data = await r.json();
      const msg = data.messages?.[0];
      const headers: { name: string; value: string }[] = msg?.payload?.headers ?? [];
      const get = (n: string) => headers.find((h) => h.name === n)?.value ?? '';
      return {
        id: t.id,
        subject: get('Subject'),
        from: get('From'),
        date: get('Date'),
        snippet: msg?.snippet ?? '',
        messageCount: data.messages?.length ?? 1,
      };
    }),
  );

  return NextResponse.json({ connected: true, threads: details.filter(Boolean) });
}
