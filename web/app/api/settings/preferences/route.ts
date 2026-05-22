import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/require-auth';
import { getSql } from '@/lib/db';

function getDb() {
  return getSql();
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sql = getDb();
  const key = `${user.email}:leadme_preferences`;
  const rows = await sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`;
  if (!(rows[0] as { value?: string } | undefined)?.value) return NextResponse.json(null);
  try { return NextResponse.json(JSON.parse((rows[0] as { value: string }).value)); }
  catch { return NextResponse.json(null); }
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const payload = {
    mode: body.mode ?? 'leverage',
    levels: body.levels ?? [],
    functions: body.functions ?? [],
    geographies: body.geographies ?? [],
    floorSalaryMXN: body.floorSalaryMXN ?? 0,
    currency: body.currency ?? 'MXN',
    salaryType: body.salaryType ?? 'gross',
    humanAnswer: body.humanAnswer ?? '',
    baseSalaryFloor: body.baseSalaryFloor ?? 0,
    baseSalaryStretch: body.baseSalaryStretch ?? 0,
    bonusPct: body.bonusPct ?? null,
    equityPct: body.equityPct ?? null,
    benefits: body.benefits ?? [],
    targetCompanies: body.targetCompanies ?? [],
    portals: body.portals ?? [],
    searchKeywords: body.searchKeywords ?? [],
    savedAt: new Date().toISOString(),
  };

  const sql = getDb();
  const key = `${user.email}:leadme_preferences`;
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${JSON.stringify(payload)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
  return NextResponse.json({ ok: true });
}
