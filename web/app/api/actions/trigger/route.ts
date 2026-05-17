import { NextRequest, NextResponse } from 'next/server';
import { triggerWorkflow } from '@/lib/github';
import { requireAuth } from '@/lib/require-auth';

const ALLOWED = ['scan-portals', 'scan-linkedin', 'analyze-patterns', 'followup', 'verify'];

export async function POST(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { workflow } = await req.json();
  if (!ALLOWED.includes(workflow)) {
    return NextResponse.json({ error: 'Unknown workflow' }, { status: 400 });
  }

  await triggerWorkflow(`${workflow}.yml`);
  return NextResponse.json({ ok: true });
}
