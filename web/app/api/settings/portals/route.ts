import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { readYaml, writeYaml } from '@/lib/settings';

const PATH = 'portals.yml';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const { data, sha } = await readYaml(PATH);
  return NextResponse.json({ data, sha });
}

export async function PUT(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { data, sha } = await req.json();
  await writeYaml(PATH, data, sha, 'settings: update portals');
  return NextResponse.json({ ok: true });
}
