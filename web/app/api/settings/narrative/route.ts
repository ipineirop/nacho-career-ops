import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { getFile, updateFile } from '@/lib/github';

const PATH = 'modes/_profile.md';

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const { content, sha } = await getFile(PATH);
  return NextResponse.json({ content, sha });
}

export async function PUT(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { content, sha } = await req.json();
  await updateFile(PATH, content, sha, 'settings: update narrative');
  return NextResponse.json({ ok: true });
}
