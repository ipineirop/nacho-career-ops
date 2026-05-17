import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 });

  try {
    const sql = neon(url);
    const rows = await sql`SELECT id, company, date FROM applications ORDER BY id DESC LIMIT 3`;
    return NextResponse.json({ ok: true, url_prefix: url.slice(0, 40), rows });
  } catch (err: unknown) {
    const e = err as { message?: string; code?: string; stack?: string };
    return NextResponse.json({
      error: e?.message ?? String(err),
      code: e?.code,
      stack: e?.stack?.slice(0, 500),
    }, { status: 500 });
  }
}
