import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function getUrl() {
  return (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!)
    .replace(/[?&]channel_binding=[^&]*/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
}

async function upsertSetting(key: string, value: string) {
  const sql = neon(getUrl());
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/settings?tab=credentials&google=error`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${origin}/api/auth/google/callback`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/settings?tab=credentials&google=error`);
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json();
  const expiresAt = Date.now() + (expires_in ?? 3600) * 1000;

  await upsertSetting('google_access_token', access_token);
  if (refresh_token) await upsertSetting('google_refresh_token', refresh_token);
  await upsertSetting('google_token_expires_at', String(expiresAt));

  return NextResponse.redirect(`${origin}/gmail?connected=1`);
}
