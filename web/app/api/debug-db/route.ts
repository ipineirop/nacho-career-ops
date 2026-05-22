import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`SELECT id, company, date FROM applications ORDER BY id DESC LIMIT 3`;
    return NextResponse.json({ ok: true, rows });
  } catch (err: unknown) {
    const e = err as { message?: string; code?: string; stack?: string };
    return NextResponse.json({
      error: e?.message ?? String(err),
      code: e?.code,
      stack: e?.stack?.slice(0, 500),
    }, { status: 500 });
  }
}
