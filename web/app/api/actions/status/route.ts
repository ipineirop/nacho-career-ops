import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowStatus } from '@/lib/github';
import { requireAuth } from '@/lib/require-auth';

export async function GET(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const workflow = req.nextUrl.searchParams.get('workflow');
  if (!workflow) return NextResponse.json({ error: 'workflow required' }, { status: 400 });

  const status = await getWorkflowStatus(`${workflow}.yml`);
  return NextResponse.json(status);
}
